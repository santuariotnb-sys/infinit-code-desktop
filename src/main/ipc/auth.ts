import { ipcMain, BrowserWindow, shell } from 'electron';
import http from 'http';
import https from 'https';
import ElectronStore from 'electron-store';

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

// ── GitHub OAuth (porta 4244 — distinta do flow de repos 4242) ─────
const GH_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liFYvVqtk4wX3qrE';

function githubLoginFlow(): Promise<{ email: string; name: string; avatar: string } | null> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlObj = new URL(req.url!, 'http://localhost:4244');
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
          hostname: 'github.com',
          path: '/login/oauth/access_token',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'Infinit-Code-Desktop',
          },
        }, `client_id=${GH_CLIENT_ID}&code=${code}`);

        const { access_token } = JSON.parse(tokenRaw);
        if (!access_token) { resolve(null); return; }

        const userRaw = await httpsGet('https://api.github.com/user', access_token);
        const user = JSON.parse(userRaw);

        // GitHub pode não retornar email público — busca na lista
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
      } catch {
        resolve(null);
      }
    });

    server.listen(4244, () => {
      shell.openExternal(
        `https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&scope=user:email&redirect_uri=http://localhost:4244/callback`
      );
    });

    server.on('error', () => resolve(null));
    setTimeout(() => { server.close(); resolve(null); }, 300_000);
  });
}

// ── Google OAuth (porta 4245) ──────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT = 'http://localhost:4245/callback';

function googleLoginFlow(): Promise<{ email: string; name: string; avatar: string } | null> {
  if (!GOOGLE_CLIENT_ID) return Promise.resolve(null);

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

  ipcMain.handle('auth:github', async () => {
    try {
      const user = await githubLoginFlow();
      if (!user) return { ok: false, error: 'Login cancelado ou falhou' };
      store.set('session', { ...user, provider: 'github' });
      return { ok: true, ...user, provider: 'github' };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('auth:google', async () => {
    try {
      if (!GOOGLE_CLIENT_ID) return { ok: false, error: 'Google OAuth não configurado' };
      const user = await googleLoginFlow();
      if (!user) return { ok: false, error: 'Login cancelado ou falhou' };
      store.set('session', { ...user, provider: 'google' });
      return { ok: true, ...user, provider: 'google' };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('auth:session', () => {
    return store.get('session') || null;
  });

  ipcMain.handle('auth:logout', () => {
    store.delete('session');
    return true;
  });
}
