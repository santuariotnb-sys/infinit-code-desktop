require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
import { app, BrowserWindow, session, shell, ipcMain, Menu, systemPreferences } from 'electron';
import path from 'path';
import { execSync } from 'child_process';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerFileHandlers } from './ipc/files';
import { registerClaudeHandlers } from './ipc/claude';
import { registerGithubHandlers } from './ipc/github';
import { registerLicenseHandlers } from './ipc/license';
import { registerAuthHandlers } from './ipc/auth';
import { registerSkillsHandlers } from './ipc/skills';
import { registerAIProviderHandlers } from './ipc/aiProviders';
import { registerHealthHandlers } from './ipc/health';
import { registerBroadcastHandlers } from './ipc/broadcast';
import { runAutoSetup } from './services/auto-setup';
import { initUpdater } from './services/updater';
import { startHealthMonitor, stopHealthMonitor } from './services/health';
import { startBroadcastMonitor, stopBroadcastMonitor } from './services/broadcast';
import { setLicenseKey } from './services/error-reporter';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Remove macOS Gatekeeper quarantine no primeiro launch
// Sem isso: "app está danificado" a cada abertura em apps não assinados
if (process.platform === 'darwin' && app.isPackaged) {
  try {
    const appBundle = path.dirname(path.dirname(path.dirname(path.dirname(app.getPath('exe')))));
    execSync(`xattr -rd com.apple.quarantine "${appBundle}"`, { timeout: 5000, stdio: 'ignore' });
  } catch { /* já limpo ou sem quarentena */ }
}

// Habilita Web Speech API — necessário para SpeechRecognition funcionar no Electron
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI,AudioServiceOutOfProcess');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    backgroundColor: '#dde0e5',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Substitui o user-agent Electron por Chrome padrão —
  // necessário para Web Speech API funcionar (Google bloqueia UA do Electron)
  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Aguarda o renderer montar e registrar os listeners antes de emitir eventos de setup
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        runAutoSetup(mainWindow);
        startHealthMonitor(mainWindow);
        startBroadcastMonitor(mainWindow);
      }
    }, 600);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Remove X-Frame-Options e frame-ancestors de respostas localhost
  // para permitir que o preview do dev server apareça no iframe
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };

    // Strip headers que bloqueiam iframe (Next.js, Vite, etc. enviam esses)
    delete headers['x-frame-options'];
    delete headers['X-Frame-Options'];

    // Remove frame-ancestors do CSP do servidor de dev
    if (details.url.startsWith('http://localhost') || details.url.startsWith('http://127.0.0.1')) {
      const cspKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-security-policy');
      if (cspKey) {
        headers[cspKey] = (headers[cspKey] as string[]).map((v) =>
          v.replace(/frame-ancestors[^;]*(;|$)/gi, '').trim()
        );
      }
    } else {
      // CSP do próprio app Electron
      headers['Content-Security-Policy'] = [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://app-infinitcode.netlify.app https://www.google.com https://*.googleapis.com https://generativelanguage.googleapis.com https://api.groq.com https://openrouter.ai ws://localhost:* http://localhost:*; " +
        "frame-src 'self' http://localhost:* http://127.0.0.1:*; " +
        "img-src 'self' data: https:;"
      ];
    }

    callback({ responseHeaders: headers });
  });

  // Permite acesso ao microfone para Web Speech API (chat voice input)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });

  // Register IPC handlers only once (guard against window re-creation on activate)
  if (!handlersRegistered) {
    handlersRegistered = true;
    registerTerminalHandlers(mainWindow);
    registerFileHandlers(mainWindow);
    registerClaudeHandlers(mainWindow);
    registerGithubHandlers(mainWindow);
    registerLicenseHandlers(mainWindow);
    registerAuthHandlers(mainWindow);
    registerSkillsHandlers(mainWindow);
    registerAIProviderHandlers(mainWindow);
    registerHealthHandlers();
    registerBroadcastHandlers();

    ipcMain.handle('window:screenshot', async () => {
      try {
        const img = await mainWindow!.webContents.capturePage();
        return img.toDataURL();
      } catch { return ''; }
    });

    ipcMain.handle('shell:open', async (_event, url: string) => {
      const parsed = new URL(url);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        await shell.openExternal(url);
      }
    });

    // Verifica status da permissão de microfone no macOS (sem mostrar dialog do sistema —
    // o dialog nativo é disparado pelo getUserMedia diretamente no renderer)
    ipcMain.handle('media:request-microphone', async () => {
      if (process.platform !== 'darwin') return { granted: true, status: 'granted' };
      try {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        return { granted: status === 'granted', status };
      } catch {
        return { granted: false, status: 'unknown' };
      }
    });

    // Stub para updater:check — update-electron-app gerencia automático, sem necessidade de invoke manual
    ipcMain.handle('updater:check', () => ({ ok: true }));
  }

  // Auto updater
  initUpdater(mainWindow);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      const tag = ['verbose', 'info', 'warn', 'error'][level] ?? 'log';
      console.log(`[renderer:${tag}] ${message} (${sourceId}:${line})`);
    });
  }
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
      ]
    : [
        {
          label: 'File',
          submenu: [
            {
              label: 'Open Folder',
              click: () => mainWindow?.webContents.send('menu:open-folder'),
            },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
          ],
        },
        {
          label: 'Help',
          submenu: [
            { role: 'about' },
          ],
        },
      ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  stopHealthMonitor();
  stopBroadcastMonitor();
  if (process.platform !== 'darwin') app.quit();
});

let handlersRegistered = false;

app.whenReady().then(() => {
  // Define user-agent na sessão inteira — Web Speech API precisa de Chrome UA
  // (Google bloqueia requests com o UA padrão do Electron)
  session.defaultSession.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
