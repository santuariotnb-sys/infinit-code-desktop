import { ipcMain, BrowserWindow, shell } from 'electron';
import { execSync, spawn } from 'child_process';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Keytar optional – may not be built in every env
let keytar: { getPassword: (s: string, a: string) => Promise<string | null>; setPassword: (s: string, a: string, p: string) => Promise<void>; deletePassword: (s: string, a: string) => Promise<boolean> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  keytar = require('keytar');
} catch { /* keytar unavailable */ }

const SERVICE = 'infinit-code-github';
const ACCOUNT = 'oauth-token';
const CLIENT_ID = 'Ov23liFYvVqtk4wX3qrE';

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

async function getToken(): Promise<string | null> {
  if (keytar) return keytar.getPassword(SERVICE, ACCOUNT);
  return null;
}

const fsWatchers = new Map<string, fs.FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function safeSend(win: BrowserWindow, channel: string, payload: unknown) {
  if (!win.isDestroyed()) win.webContents.send(channel, payload);
}

export function registerGithubHandlers(mainWindow: BrowserWindow): void {

  // ── OAuth connect ──────────────────────────────────────────
  ipcMain.handle('github:connect-oauth', () => {
    return new Promise<{ connected: boolean; username?: string; avatar_url?: string; error?: string }>((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          const urlObj = new URL(req.url!, 'http://localhost:4242');
          if (urlObj.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

          const code = urlObj.searchParams.get('code');
          if (!code) {
            res.writeHead(400); res.end('No code');
            server.close();
            resolve({ connected: false, error: 'No code received' });
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="font-family:sans-serif;background:#0a0a0a;color:#00ff88;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>✓ GitHub conectado! Volte ao Infinit Code.</h2></body></html>');
          server.close();

          const tokenRaw = await httpsPost({
            hostname: 'github.com',
            path: '/login/oauth/access_token',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'Infinit-Code-Desktop' },
          }, `client_id=${CLIENT_ID}&code=${code}`);

          const tokenData = JSON.parse(tokenRaw);
          const token: string = tokenData.access_token;
          if (!token) { resolve({ connected: false, error: 'Token not received' }); return; }

          if (keytar) await keytar.setPassword(SERVICE, ACCOUNT, token);

          const userRaw = await httpsGet('https://api.github.com/user', token);
          const user = JSON.parse(userRaw);
          resolve({ connected: true, username: user.login, avatar_url: user.avatar_url });
        } catch (e) {
          resolve({ connected: false, error: String(e) });
        }
      });

      server.listen(4242, () => {
        shell.openExternal(`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user`);
      });
      server.on('error', (e) => resolve({ connected: false, error: e.message }));
      setTimeout(() => { server.close(); resolve({ connected: false, error: 'Timeout' }); }, 300_000);
    });
  });

  // ── Auth status ────────────────────────────────────────────
  ipcMain.handle('github:auth-status', async () => {
    try {
      const token = await getToken();
      if (!token) return { connected: false };
      const raw = await httpsGet('https://api.github.com/user', token);
      const user = JSON.parse(raw);
      return { connected: true, username: user.login, avatar: user.avatar_url };
    } catch {
      return { connected: false };
    }
  });

  // ── Disconnect ─────────────────────────────────────────────
  ipcMain.handle('github:disconnect', async () => {
    if (keytar) await keytar.deletePassword(SERVICE, ACCOUNT);
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

      const token = await getToken();
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
      const token = await getToken();
      if (!token) return { repos: [], error: 'Not authenticated' };
      const raw = await httpsGet('https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator', token);
      const list: Record<string, unknown>[] = JSON.parse(raw);
      return {
        repos: list.map((r) => ({
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          defaultBranch: r.default_branch,
          updatedAt: r.updated_at,
          description: r.description,
          language: r.language,
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
