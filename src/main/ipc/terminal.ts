import { ipcMain, BrowserWindow } from 'electron';
import os from 'os';
import * as pty from 'node-pty';
import treeKill from 'tree-kill';

let ptyProcess: pty.IPty | null = null;
let ptyGhost: pty.IPty | null = null; // Terminal fantasma — roda dev server em background

export function registerTerminalHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('terminal:create', (_event, cwd?: string) => {
    try {
      // Idempotente: se PTY já existe e não foi solicitado novo cwd, reconecta sem matar.
      // Isso evita o bug de terminal reiniciando ao abrir arquivo ou preview.
      if (ptyProcess && !cwd) {
        return { ok: true, cols: 80, rows: 24, reused: true };
      }

      // Só recria se forçado com novo cwd (ex: mudança de projeto)
      if (ptyProcess) {
        const pid = ptyProcess.pid;
        ptyProcess.kill();
        ptyProcess = null;
        if (pid) treeKill(pid, 'SIGTERM');
      }

      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      const homedir = os.homedir();

      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: cwd || homedir,
        handleFlowControl: true,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      });

      ptyProcess.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:data', data);
        }
      });

      ptyProcess.onExit(() => {
        ptyProcess = null;
        // Notifica renderer para auto-restart do terminal
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit');
        }
      });

      return { ok: true, cols: 80, rows: 24 };
    } catch (error) {
      console.error('[terminal:create]', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('terminal:write', (_event, data: string) => {
    ptyProcess?.write(data);
  });

  ipcMain.handle('terminal:resize', (_event, cols: number, rows: number) => {
    try {
      ptyProcess?.resize(cols, rows);
    } catch {
      // ignore resize errors
    }
  });

  ipcMain.handle('terminal:kill', () => {
    if (ptyProcess) {
      const pid = ptyProcess.pid;
      ptyProcess.kill();
      ptyProcess = null;
      if (pid) treeKill(pid, 'SIGTERM');
    }
  });

  // ── Ghost terminal — PTY invisível para o dev server ──────────────────────
  function killGhost() {
    if (ptyGhost) {
      const pid = ptyGhost.pid;
      try { ptyGhost.kill(); } catch { /* ignore */ }
      ptyGhost = null;
      if (pid) treeKill(pid, 'SIGTERM');
    }
  }

  ipcMain.handle('terminal:ghost:create', (_event, cwd: string) => {
    try {
      killGhost();
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
      ptyGhost = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: cwd || os.homedir(),
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      });
      ptyGhost.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:ghost:data', data);
        }
      });
      ptyGhost.onExit(() => {
        ptyGhost = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:ghost:exit');
        }
      });
      return { ok: true };
    } catch (error) {
      console.error('[terminal:ghost:create]', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('terminal:ghost:write', (_event, data: string) => {
    try { ptyGhost?.write(data); return { ok: true }; }
    catch (error) { return { ok: false, error: (error as Error).message }; }
  });

  ipcMain.handle('terminal:ghost:kill', () => {
    killGhost();
    return { ok: true };
  });
}
