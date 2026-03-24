import { ipcMain, BrowserWindow } from 'electron';
import { execSync, spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { getSecret, setSecret, deleteSecret } from '../services/keychain';

const CLIENT_ID = 'Ov23liFYvVqtk4wX3qrE';
const GH_TOKEN_KEY = 'gh-token';

function getToken(): string | null { return getSecret(GH_TOKEN_KEY); }
function saveToken(token: string): void { setSecret(GH_TOKEN_KEY, token); }
function deleteToken(): void { deleteSecret(GH_TOKEN_KEY); }

function httpsGet(url: string, token?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts: https.RequestOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Infinit-Code-Desktop',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpsPost(opts: https.RequestOptions, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request({ ...opts, method: 'POST' }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}


const fsWatchers = new Map<string, fs.FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function safeSend(win: BrowserWindow, channel: string, payload: unknown) {
  if (!win.isDestroyed()) win.webContents.send(channel, payload);
}

export function registerGithubHandlers(mainWindow: BrowserWindow): void {

  // ── Device Flow: step 1 — request device code ─────────────
  ipcMain.handle('github:device-flow-start', async () => {
    try {
      const raw = await httpsPost({
        hostname: 'github.com',
        path: '/login/device/code',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'Infinit-Code-Desktop' },
      }, `client_id=${CLIENT_ID}&scope=repo%2Cuser`);
      const data = JSON.parse(raw);
      if (data.error) return { ok: false, error: data.error_description || data.error };
      return {
        ok: true,
        userCode: data.user_code as string,
        verificationUri: data.verification_uri as string,
        deviceCode: data.device_code as string,
        interval: (data.interval as number) || 5,
        expiresIn: (data.expires_in as number) || 900,
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // ── Device Flow: step 2 — poll until authorized ────────────
  ipcMain.handle('github:device-flow-poll', (_evt, deviceCode: string, intervalSecs: number) => {
    return new Promise<{ connected: boolean; user?: string; error?: string }>((resolve) => {
      let interval = intervalSecs * 1000;
      let attempts = 0;
      const maxAttempts = Math.floor(900 / intervalSecs) + 10;

      async function poll() {
        attempts++;
        if (attempts > maxAttempts) { resolve({ connected: false, error: 'Expirou. Tente novamente.' }); return; }
        try {
          const raw = await httpsPost({
            hostname: 'github.com',
            path: '/login/oauth/access_token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'Infinit-Code-Desktop' },
          }, `client_id=${CLIENT_ID}&device_code=${deviceCode}&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`);
          const data = JSON.parse(raw);

          if (data.access_token) {
            saveToken(data.access_token);
            const userRaw = await httpsGet('https://api.github.com/user', data.access_token);
            const user = JSON.parse(userRaw);
            resolve({ connected: true, user: user.login });
            return;
          }
          if (data.error === 'slow_down') { interval += 5000; }
          if (data.error === 'expired_token') { resolve({ connected: false, error: 'Código expirou. Tente novamente.' }); return; }
          if (data.error === 'access_denied') { resolve({ connected: false, error: 'Acesso negado pelo usuário.' }); return; }
          // authorization_pending or slow_down → keep polling
          safeSend(mainWindow, 'github:device-flow-progress', { waiting: true });
          setTimeout(poll, interval);
        } catch (e) {
          resolve({ connected: false, error: String(e) });
        }
      }
      poll();
    });
  });

  // ── PAT (Personal Access Token) direct save ────────────────
  ipcMain.handle('github:save-pat', async (_evt, token: string) => {
    try {
      const userRaw = await httpsGet('https://api.github.com/user', token);
      const user = JSON.parse(userRaw);
      if (!user.login) return { ok: false, error: 'Token inválido' };
      saveToken(token);
      return { ok: true, user: user.login };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // ── Auth status ────────────────────────────────────────────
  ipcMain.handle('github:auth-status', async () => {
    try {
      const token = getToken();
      if (!token) return { connected: false };
      const raw = await httpsGet('https://api.github.com/user', token);
      const user = JSON.parse(raw);
      return { connected: true, user: user.login, avatar: user.avatar_url };
    } catch {
      return { connected: false };
    }
  });

  // ── Disconnect ─────────────────────────────────────────────
  ipcMain.handle('github:disconnect', async () => {
    deleteToken();
    return { ok: true };
  });

  // ── Git installed check ────────────────────────────────────
  ipcMain.handle('github:check-installed', () => {
    try {
      const cmd = process.platform === 'win32' ? 'where git' : 'which git';
      execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
      const version = execSync('git --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false };
    }
  });

  // ── Clone ──────────────────────────────────────────────────
  ipcMain.handle('github:clone', async (_evt, repo: string, destPath: string) => {
    try {
      // Validate destPath: must be inside the user's home directory
      const resolvedDest = path.resolve(destPath);
      const homeDir = path.resolve(os.homedir());
      if (!resolvedDest.startsWith(homeDir + path.sep) && resolvedDest !== homeDir) {
        return { ok: false, error: 'Destino inválido: use uma pasta dentro do seu diretório home.' };
      }
      // Reject path traversal sequences
      if (destPath.includes('..')) {
        return { ok: false, error: 'Caminho inválido.' };
      }

      const token = getToken();
      if (token) {
        const userRaw = await httpsGet('https://api.github.com/user', token);
        const user = JSON.parse(userRaw);
        const credPath = path.join(os.homedir(), '.git-credentials');
        const line = `https://${user.login}:${token}@github.com`;
        let existing = fs.existsSync(credPath) ? fs.readFileSync(credPath, 'utf-8') : '';
        if (!existing.includes('github.com')) {
          fs.writeFileSync(credPath, existing + '\n' + line + '\n', { mode: 0o600 });
        }
        execSync('git config --global credential.helper store', { timeout: 5000 });
      }
      const cloneUrl = repo.startsWith('http') ? repo : `https://github.com/${repo}.git`;
      return new Promise<{ ok: boolean; path?: string; error?: string }>((resolve) => {
        const proc = spawn('git', ['clone', cloneUrl, resolvedDest]);
        proc.stdout?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
        proc.stderr?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
        proc.on('close', (code) => code === 0 ? resolve({ ok: true, path: resolvedDest }) : resolve({ ok: false, error: `Exit ${code}` }));
      });
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // ── List repos ─────────────────────────────────────────────
  ipcMain.handle('github:list-repos', async () => {
    try {
      const token = getToken();
      if (!token) return { repos: [], error: 'Não autenticado' };

      const raw = await httpsGet('https://api.github.com/user/repos?sort=updated&per_page=100', token);
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return { repos: [], error: 'Resposta inválida da API' }; }

      if (!Array.isArray(parsed)) {
        const msg = (parsed as Record<string, unknown>)?.message as string | undefined;
        return { repos: [], error: msg ?? 'Erro na API do GitHub' };
      }

      const list = parsed as Record<string, unknown>[];
      return {
        repos: list.map((r) => ({
          name:          r.name,
          fullName:      r.full_name,
          private:       r.private,
          defaultBranch: r.default_branch,
          updatedAt:     r.updated_at,
          description:   r.description,
          language:      r.language,
        })),
      };
    } catch (e) {
      return { repos: [], error: String(e) };
    }
  });

  // ── Local git status ───────────────────────────────────────
  ipcMain.handle('github:git-status', (_evt, cwd: string) => {
    try {
      const statusOut = execSync('git status --porcelain', { cwd, encoding: 'utf-8', timeout: 5000 });
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      return {
        isRepo: true,
        branch,
        changes: statusOut.split('\n').filter(Boolean).map((line) => ({
          status: line.substring(0, 2).trim(),
          file: line.substring(3),
        })),
      };
    } catch {
      return { isRepo: false, branch: '', changes: [] };
    }
  });

  // ── Commit (add → commit with message) ─────────────────────
  ipcMain.handle('github:commit', (_evt, cwd: string, message: string) => {
    try {
      execSync('git add -A', { cwd, encoding: 'utf-8', timeout: 5000 });
      execSync(`git commit -m ${JSON.stringify(message)}`, { cwd, encoding: 'utf-8', timeout: 5000 });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  // ── Sync (add → commit → pull --rebase → push) ─────────────
  ipcMain.handle('github:sync', (_evt, cwd: string, branch: string) => {
    return new Promise<{ pushed: boolean; conflicts: boolean; log: string }>((resolve) => {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const steps: [string, string[]][] = [
        ['git', ['add', '-A']],
        ['git', ['commit', '-m', `auto-sync: ${ts}`]],
        ['git', ['pull', '--rebase', 'origin', branch]],
        ['git', ['push', 'origin', branch]],
      ];
      let log = '';
      let conflicts = false;
      let idx = 0;

      function next() {
        if (idx >= steps.length) {
          resolve({ pushed: log.includes('->') || log.includes('master') || log.includes(branch), conflicts, log });
          return;
        }
        const [cmd, args] = steps[idx++];
        safeSend(mainWindow, 'github:sync-progress', { step: `${cmd} ${args.join(' ')}` });
        const proc = spawn(cmd, args, { cwd });
        proc.stdout?.on('data', (d: Buffer) => {
          log += d.toString();
          safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() });
        });
        proc.stderr?.on('data', (d: Buffer) => {
          const t = d.toString();
          log += t;
          if (t.includes('CONFLICT')) conflicts = true;
          safeSend(mainWindow, 'github:sync-progress', { msg: t.trim() });
        });
        proc.on('close', next);
      }
      next();
    });
  });

  // ── Pull ───────────────────────────────────────────────────
  ipcMain.handle('github:pull', (_evt, cwd: string, branch: string) => {
    return new Promise<{ ok: boolean }>((resolve) => {
      const proc = spawn('git', ['pull', 'origin', branch], { cwd });
      proc.stdout?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
      proc.stderr?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
      proc.on('close', (code) => resolve({ ok: code === 0 }));
    });
  });

  // ── Push ───────────────────────────────────────────────────
  ipcMain.handle('github:push', (_evt, cwd: string, branch: string) => {
    return new Promise<{ ok: boolean }>((resolve) => {
      const proc = spawn('git', ['push', 'origin', branch], { cwd });
      proc.stdout?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
      proc.stderr?.on('data', (d: Buffer) => safeSend(mainWindow, 'github:sync-progress', { msg: d.toString().trim() }));
      proc.on('close', (code) => resolve({ ok: code === 0 }));
    });
  });

  // ── List branches ──────────────────────────────────────────
  ipcMain.handle('github:branches', (_evt, cwd: string) => {
    try {
      const out = execSync('git branch -a', { cwd, encoding: 'utf-8', timeout: 5000 });
      const branches = [...new Set(
        out.split('\n')
          .map((b) => b.trim().replace(/^\* /, '').replace(/^remotes\/origin\//, ''))
          .filter((b) => b && !b.includes('->')),
      )];
      return { branches };
    } catch {
      return { branches: [] };
    }
  });

  // ── Create branch ──────────────────────────────────────────
  ipcMain.handle('github:create-branch', (_evt, cwd: string, name: string) => {
    try {
      execSync(`git checkout -b "${name}"`, { cwd, encoding: 'utf-8', timeout: 10000 });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  // ── Watch for local changes ────────────────────────────────
  ipcMain.handle('github:watch-for-changes', (_evt, projectPath: string) => {
    if (fsWatchers.has(projectPath)) {
      fsWatchers.get(projectPath)!.close();
      fsWatchers.delete(projectPath);
    }
    try {
      const IGNORED = new Set(['node_modules', '.git', '.next', 'dist', '.webpack', 'build', '__pycache__']);
      const changed = new Set<string>();

      const watcher = fs.watch(projectPath, { recursive: true }, (_evt, filename) => {
        if (!filename) return;
        const parts = filename.split(path.sep);
        if (parts.some((p) => IGNORED.has(p))) return;
        changed.add(filename);
        if (debounceTimers.has(projectPath)) clearTimeout(debounceTimers.get(projectPath)!);
        debounceTimers.set(projectPath, setTimeout(() => {
          if (!mainWindow.isDestroyed()) {
            safeSend(mainWindow, 'github:local-changes', { files: [...changed] });
          }
          changed.clear();
          debounceTimers.delete(projectPath);
        }, 2000));
      });

      fsWatchers.set(projectPath, watcher);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
}
