import { ipcMain, BrowserWindow, shell } from 'electron';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ElectronStore from 'electron-store';

import { getSecret, setSecret } from '../services/keychain';

const GH_TOKEN_KEY = 'gh-token';

function saveGhToken(token: string) { setSecret(GH_TOKEN_KEY, token); }
function getGhToken(): string | null { return getSecret(GH_TOKEN_KEY); }

const store = new ElectronStore<{
  session?: { email: string; name: string; avatar: string; provider: 'google' | 'github' };
}>({ name: 'infinit-auth' });

// ── HTTPS helpers ──────────────────────────────────────────────────
function httpsGet(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Infinit-Code-Desktop',
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
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

// ── GitHub Device Flow (sem client_secret, ideal para desktop) ─────
const GH_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liFYvVqtk4wX3qrE';

async function githubLoginFlow(): Promise<{ email: string; name: string; avatar: string } | null> {
  // 1. Solicitar device code
  const deviceRaw = await httpsPost({
    hostname: 'github.com',
    path: '/login/device/code',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Infinit-Code-Desktop',
    },
  }, `client_id=${GH_CLIENT_ID}&scope=user:email`);

  const { device_code, user_code, verification_uri, interval = 5, expires_in = 900 } = JSON.parse(deviceRaw);
  if (!device_code) return null;

  // 2. Mostrar código ao usuário e abrir browser
  const { dialog } = await import('electron');
  dialog.showMessageBox({
    type: 'info',
    title: 'Login com GitHub',
    message: 'Código de verificação:',
    detail: `${user_code}\n\nO browser vai abrir. Cole este código quando solicitado e autorize o Infinit Code.`,
    buttons: ['Abrir GitHub'],
    defaultId: 0,
  });
  shell.openExternal(verification_uri);

  // 3. Polling até o usuário autorizar
  const pollMs = (interval + 1) * 1000;
  const expiresAt = Date.now() + expires_in * 1000;

  return new Promise((resolve) => {
    const poll = async () => {
      if (Date.now() > expiresAt) { resolve(null); return; }
      try {
        const tokenRaw = await httpsPost({
          hostname: 'github.com',
          path: '/login/oauth/access_token',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'Infinit-Code-Desktop',
          },
        }, `client_id=${GH_CLIENT_ID}&device_code=${device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`);

        const { access_token, error } = JSON.parse(tokenRaw);

        if (access_token) {
          // Salva token para github:list-repos (mesmo arquivo que github.ts lê)
          saveGhToken(access_token);

          const userRaw = await httpsGet('https://api.github.com/user', access_token);
          const user = JSON.parse(userRaw);
          let email = user.email || '';
          if (!email) {
            try {
              const emailsRaw = await httpsGet('https://api.github.com/user/emails', access_token);
              const emails: { email: string; primary: boolean; verified: boolean }[] = JSON.parse(emailsRaw);
              const primary = emails.find((e) => e.primary && e.verified);
              email = primary?.email || emails[0]?.email || '';
            } catch { /* sem emails */ }
          }
          resolve({ email, name: user.name || user.login, avatar: user.avatar_url });
        } else if (error === 'authorization_pending' || error === 'slow_down') {
          setTimeout(poll, pollMs);
        } else {
          resolve(null);
        }
      } catch {
        setTimeout(poll, pollMs);
      }
    };
    setTimeout(poll, pollMs);
  });
}

// ── Google OAuth (porta 4245) ──────────────────────────────────────
const GOOGLE_CREDS_FILE = path.join(os.homedir(), '.config', 'infinit-code', 'google-oauth.json');
const GOOGLE_REDIRECT = 'http://localhost:4245/callback';

function getGoogleCreds(): { clientId: string; clientSecret: string } | null {
  // 1. Arquivo de config (~/.config/infinit-code/google-oauth.json)
  try {
    if (fs.existsSync(GOOGLE_CREDS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(GOOGLE_CREDS_FILE, 'utf-8'));
      if (raw.client_id && raw.client_secret) return { clientId: raw.client_id, clientSecret: raw.client_secret };
    }
  } catch { /* ignore */ }
  // 2. Variáveis de ambiente
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
  }
  return null;
}

function googleLoginFlow(): Promise<{ email: string; name: string; avatar: string } | null> {
  const creds = getGoogleCreds();
  if (!creds) return Promise.resolve(null);
  const GOOGLE_CLIENT_ID = creds.clientId;
  const GOOGLE_CLIENT_SECRET = creds.clientSecret;

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url!, 'http://localhost:4245');
        if (urlObj.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

        const code = urlObj.searchParams.get('code');
        if (!code) {
          res.writeHead(400); res.end('No code');
          server.close(); resolve(null); return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;background:#dde0e5;color:#1a1c20;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2 style="color:#3CB043">✓ Login realizado! Volte ao Infinit Code.</h2></body></html>');
        server.close();

        const tokenRaw = await httpsPost({
          hostname: 'oauth2.googleapis.com',
          path: '/token',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }, new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: GOOGLE_REDIRECT,
          grant_type: 'authorization_code',
        }).toString());

        const { access_token } = JSON.parse(tokenRaw);
        if (!access_token) { resolve(null); return; }

        const userRaw = await httpsGet('https://www.googleapis.com/oauth2/v2/userinfo', access_token);
        const user = JSON.parse(userRaw);

        resolve({ email: user.email, name: user.name, avatar: user.picture });
      } catch {
        resolve(null);
      }
    });

    server.listen(4245, () => {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT,
        response_type: 'code',
        scope: 'email profile',
        access_type: 'offline',
        prompt: 'select_account',
      });
      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    });

    server.on('error', () => resolve(null));
    setTimeout(() => { server.close(); resolve(null); }, 300_000);
  });
}

// ── IPC Handlers ───────────────────────────────────────────────────
export function registerAuthHandlers(_mainWindow: BrowserWindow): void {

  // Tenta usar token já salvo; se não houver, tenta Device Flow
  ipcMain.handle('auth:github', async () => {
    try {
      // 1. Usa token já salvo (do PAT conectado no GitPanel)
      const savedToken = getGhToken() || '';
      if (savedToken) {
        const userRaw = await httpsGet('https://api.github.com/user', savedToken);
        const user = JSON.parse(userRaw);
        if (user.login) {
          const session = { email: user.email || user.login, name: user.name || user.login, avatar: user.avatar_url || '', provider: 'github' as const };
          store.set('session', session);
          return { ok: true, ...session };
        }
      }
      // 2. Sem token salvo — tenta Device Flow
      const user = await githubLoginFlow();
      if (!user) return { ok: false, error: 'Login cancelado ou falhou' };
      store.set('session', { ...user, provider: 'github' });
      return { ok: true, ...user, provider: 'github' };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Login via PAT — salva token e cria sessão
  ipcMain.handle('auth:github-pat', async (_evt, token: string) => {
    try {
      const userRaw = await httpsGet('https://api.github.com/user', token);
      const user = JSON.parse(userRaw);
      if (!user.login) return { ok: false, error: 'Token inválido' };
      saveGhToken(token);
      const session = { email: user.email || user.login, name: user.name || user.login, avatar: user.avatar_url || '', provider: 'github' as const };
      store.set('session', session);
      return { ok: true, ...session };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('auth:google', async () => {
    try {
      if (!getGoogleCreds()) return { ok: false, error: 'not_configured' };
      const user = await googleLoginFlow();
      if (!user) return { ok: false, error: 'Login cancelado ou falhou' };
      store.set('session', { ...user, provider: 'google' });
      return { ok: true, ...user, provider: 'google' };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Salva credenciais Google e testa imediatamente
  ipcMain.handle('auth:save-google-creds', async (_evt, clientId: string, clientSecret: string) => {
    try {
      fs.mkdirSync(path.dirname(GOOGLE_CREDS_FILE), { recursive: true });
      fs.writeFileSync(GOOGLE_CREDS_FILE, JSON.stringify({ client_id: clientId, client_secret: clientSecret }, null, 2), { mode: 0o600 });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Verifica se Google está configurado
  ipcMain.handle('auth:google-status', () => {
    return { configured: !!getGoogleCreds() };
  });

  ipcMain.handle('auth:session', () => {
    return store.get('session') || null;
  });

  ipcMain.handle('auth:logout', () => {
    store.delete('session');
    return true;
  });
}
