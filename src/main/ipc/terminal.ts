import { ipcMain, BrowserWindow } from 'electron';
import os from 'os';
import * as pty from 'node-pty';
import treeKill from 'tree-kill';

let ptyProcess: pty.IPty | null = null;
let ptyGhost: pty.IPty | null = null; // Terminal fantasma — roda dev server em background

/** Retorna o status atual do PTY principal — usado pelo Health Monitor. */
export function getPtyStatus(): 'ok' | 'dead' | 'not-started' {
  if (!ptyProcess) return 'not-started';
  try {
    const pid = ptyProcess.pid;
    return pid > 0 ? 'ok' : 'dead';
  } catch {
    return 'dead';
  }
}

/**
 * Cria um sender com throttle para não sobrecarregar o IPC.
 * Acumula dados e envia em batch a cada INTERVAL ms.
 */
function createThrottledSender(win: BrowserWindow, channel: string, intervalMs = 16) {
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!buffer || win.isDestroyed()) return;
    win.webContents.send(channel, buffer);
    buffer = '';
  };
  return (data: string) => {
    buffer += data;
    if (!timer) timer = setTimeout(flush, intervalMs);
  };
}

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

      const sendData = createThrottledSender(mainWindow, 'terminal:data');
      ptyProcess.onData((data: string) => {
        sendData(data);
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

  // Restart forçado — mata o PTY e recria, útil quando o terminal trava
  ipcMain.handle('terminal:restart', (_event, cwd?: string) => {
    try {
      if (ptyProcess) {
        const pid = ptyProcess.pid;
        try { ptyProcess.kill(); } catch { /* ignore */ }
        ptyProcess = null;
        if (pid) treeKill(pid, 'SIGKILL');
      }
      // Delega para o handler de create que já faz toda a lógica
      // Precisa forçar recriação passando cwd
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

      const sendData = createThrottledSender(mainWindow, 'terminal:data');
      ptyProcess.onData((data: string) => {
        sendData(data);
      });

      ptyProcess.onExit(() => {
        ptyProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('terminal:exit');
        }
      });

      return { ok: true, cols: 80, rows: 24 };
    } catch (error) {
      console.error('[terminal:restart]', error);
      return { ok: false, error: (error as Error).message };
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
      const sendGhostData = createThrottledSender(mainWindow, 'terminal:ghost:data');
      ptyGhost.onData((data: string) => {
        sendGhostData(data);
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
