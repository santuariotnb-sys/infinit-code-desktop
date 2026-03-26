/**
 * health.ts — Monitor de saúde do app (Claude CLI, Terminal, Preview).
 * Roda no main process a cada 30 segundos.
 * Nunca bloqueia, nunca crasha — todo erro é silenciado e logado.
 */

import { exec } from 'node:child_process';
import type { BrowserWindow } from 'electron';
import { getPtyStatus } from '../ipc/terminal';

export interface HealthStatus {
  claudeCli: 'ok' | 'not-installed' | 'not-authenticated' | 'error';
  terminal: 'ok' | 'dead' | 'not-started';
  preview: 'ok' | 'unreachable' | 'not-running';
  lastCheck: string;
}

let status: HealthStatus = {
  claudeCli: 'ok',
  terminal: 'not-started',
  preview: 'not-running',
  lastCheck: new Date().toISOString(),
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let previewPort: number | null = null;

export function setPreviewPort(port: number | null): void {
  previewPort = port;
}

export function getHealth(): HealthStatus {
  return { ...status };
}

/** Verifica o Claude CLI de forma assíncrona (exec, não execSync). */
async function checkClaudeCli(): Promise<HealthStatus['claudeCli']> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('error'), 5_000);
    exec('claude --version', (err, stdout) => {
      clearTimeout(timer);
      if (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('command not found') || msg.includes('no such file')) {
          return resolve('not-installed');
        }
        // claude existe mas retornou erro — pode ser auth
        return resolve('not-authenticated');
      }
      resolve(stdout.trim().length > 0 ? 'ok' : 'error');
    });
  });
}

/** Verifica o terminal PTY. */
function checkTerminal(): HealthStatus['terminal'] {
  try {
    return getPtyStatus();
  } catch {
    return 'dead';
  }
}

/** Verifica se o preview server está respondendo. */
async function checkPreview(): Promise<HealthStatus['preview']> {
  if (!previewPort) return 'not-running';
  try {
    const res = await fetch(`http://localhost:${previewPort}`, {
      signal: AbortSignal.timeout(3_000),
    });
    return res.status < 500 ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

async function runChecks(mainWindow: BrowserWindow): Promise<void> {
  try {
    const results = await Promise.allSettled([
      checkClaudeCli(),
      checkPreview(),
    ]);

    const claudeCli = results[0].status === 'fulfilled' ? results[0].value : 'error';
    const preview   = results[1].status === 'fulfilled' ? results[1].value : 'unreachable';
    const terminal  = checkTerminal();

    status = { claudeCli, terminal, preview, lastCheck: new Date().toISOString() };

    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('health:updated', status);
    }
  } catch (err) {
    console.error('[health] runChecks error:', err);
  }
}

export function startHealthMonitor(mainWindow: BrowserWindow): void {
  if (intervalId) return; // já rodando
  // Primeira checagem após 5s (app ainda carregando)
  setTimeout(() => runChecks(mainWindow), 5_000);
  intervalId = setInterval(() => runChecks(mainWindow), 30_000);
}

export function stopHealthMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
