import { ipcMain, BrowserWindow } from 'electron';
import os from 'os';
import * as pty from 'node-pty';
import treeKill from 'tree-kill';

let ptyProcess: pty.IPty | null = null;

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
      // tree-kill mata toda a árvore de subprocessos (claude, npm, node filhos)
      if (pid) treeKill(pid, 'SIGTERM');
    }
  });
}
