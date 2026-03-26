/**
 * error-reporter.ts — Telemetria de erros leve, sem SDK externo.
 * Fire-and-forget: nunca bloqueia, nunca crasha, nunca mostra erro ao usuário.
 */

import { app } from 'electron';
import os from 'node:os';
import { getDeviceId } from './device';

export type ErrorType =
  | 'crash'
  | 'uncaught'
  | 'ipc_error'
  | 'cli_error'
  | 'terminal_error'
  | 'preview_error'
  | 'setup_error';

export interface ErrorReport {
  type: ErrorType;
  message: string;
  stack?: string;
  version: string;
  os: string;
  deviceId: string;
  licenseKey?: string;
  screen?: string;
  timestamp: string;
}

// Rate limit: máximo 10 reports por minuto
const RATE_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const timestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  // Remove timestamps fora da janela
  while (timestamps.length > 0 && now - timestamps[0] > RATE_WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= MAX_PER_WINDOW) return true;
  timestamps.push(now);
  return false;
}

let cachedLicenseKey: string | undefined;

/** Permite que outros módulos informem a license key atual. */
export function setLicenseKey(key: string): void {
  cachedLicenseKey = key;
}

/**
 * Envia um relatório de erro para o backend.
 * Preenche automaticamente: version, os, deviceId, timestamp.
 * Campos omitidos são ignorados — partial é suficiente.
 */
export function reportError(partial: { type: ErrorType; message: string; stack?: string; screen?: string }): void {
  if (isRateLimited()) return;

  let version = '0.0.0';
  let deviceId = 'unknown';

  try { version = app.getVersion(); } catch { /* app pode não estar pronto ainda */ }
  try { deviceId = getDeviceId(); } catch { /* ignora */ }

  const report: ErrorReport = {
    type: partial.type,
    message: partial.message.slice(0, 1000), // cap 1KB
    stack: partial.stack?.slice(0, 3000),
    screen: partial.screen,
    version,
    os: `${os.platform()} ${os.release()} ${os.arch()}`,
    deviceId,
    licenseKey: cachedLicenseKey,
    timestamp: new Date().toISOString(),
  };

  // Fire-and-forget — nunca await, nunca retorna erro
  void sendReport(report);
}

async function sendReport(report: ErrorReport): Promise<void> {
  try {
    await fetch('https://app-infinitcode.netlify.app/api/telemetry/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Silencioso — nunca propaga
  }
}
