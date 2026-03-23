require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
import { app, BrowserWindow, session, shell, ipcMain, Menu } from 'electron';
import path from 'path';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerFileHandlers } from './ipc/files';
import { registerClaudeHandlers } from './ipc/claude';
import { registerGithubHandlers } from './ipc/github';
import { registerLicenseHandlers } from './ipc/license';
import { runAutoSetup } from './services/auto-setup';
import { initUpdater } from './services/updater';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

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
    backgroundColor: '#0a0a0a',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Aguarda o renderer montar e registrar os listeners antes de emitir eventos de setup
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        runAutoSetup(mainWindow);
      }
    }, 600);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "connect-src 'self' https://api.anthropic.com https://*.supabase.co https://app-infinitcode.netlify.app ws://localhost:* http://localhost:*; " +
          "frame-src 'self' http://localhost:*; " +
          "img-src 'self' data: https:;"
        ],
      },
    });
  });

  // Register IPC handlers
  registerTerminalHandlers(mainWindow);
  registerFileHandlers(mainWindow);
  registerClaudeHandlers(mainWindow);
  registerGithubHandlers(mainWindow);
  registerLicenseHandlers(mainWindow);

  // Screenshot
  ipcMain.handle('window:screenshot', async () => {
    try {
      const img = await mainWindow!.webContents.capturePage();
      return img.toDataURL();
    } catch {
      return '';
    }
  });

  // Shell open external
  ipcMain.handle('shell:open', async (_event, url: string) => {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) {
      await shell.openExternal(url);
    }
  });

  // Auto updater
  initUpdater(mainWindow);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

app.on('ready', () => {
  buildMenu();
  createWindow();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
