/**
 * broadcast.ts — Notificações in-app via polling.
 * Busca mensagens do backend a cada hora. Persiste dismissals localmente.
 * Fire-and-forget: nunca bloqueia, nunca crasha.
 */

import ElectronStore from 'electron-store';
import type { BrowserWindow } from 'electron';

export type BroadcastSeverity = 'info' | 'warning' | 'critical';

export interface BroadcastMessage {
  id: string;
  title: string;
  body: string;
  severity: BroadcastSeverity;
  expiresAt?: string; // ISO date — null = não expira
  cta?: { label: string; url: string };
}

const POLL_INTERVAL_MS = 60 * 60 * 1_000; // 1 hora
const API_URL = 'https://app-infinitcode.netlify.app/api/broadcast';

const store = new ElectronStore<{ dismissedIds: string[] }>({
  name: 'broadcast',
  defaults: { dismissedIds: [] },
});

let intervalId: ReturnType<typeof setInterval> | null = null;
let current: BroadcastMessage[] = [];

// ── State ──────────────────────────────────────────────────────────────────

export function getActiveBroadcasts(): BroadcastMessage[] {
  const dismissed = store.get('dismissedIds', []);
  const now = Date.now();
  return current.filter((m) => {
    if (dismissed.includes(m.id)) return false;
    if (m.expiresAt && new Date(m.expiresAt).getTime() < now) return false;
    return true;
  });
}

export function dismissBroadcast(id: string): void {
  const dismissed = store.get('dismissedIds', []);
  if (!dismissed.includes(id)) {
    store.set('dismissedIds', [...dismissed, id]);
  }
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchBroadcasts(win: BrowserWindow): Promise<void> {
  try {
    const res = await fetch(API_URL, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return;

    const data: BroadcastMessage[] = await res.json();
    if (!Array.isArray(data)) return;

    current = data;

    const active = getActiveBroadcasts();
    if (active.length > 0 && !win.isDestroyed()) {
      win.webContents.send('broadcast:updated', active);
    }
  } catch {
    // Silencioso — sem conexão ou backend indisponível
  }
}

// ── Monitor ────────────────────────────────────────────────────────────────

export function startBroadcastMonitor(mainWindow: BrowserWindow): void {
  if (intervalId) return; // já rodando
  // Primeira checagem após 10s (app ainda carregando)
  setTimeout(() => fetchBroadcasts(mainWindow), 10_000);
  intervalId = setInterval(() => fetchBroadcasts(mainWindow), POLL_INTERVAL_MS);
}

export function stopBroadcastMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Força checagem imediata — útil ao abrir o app com licença validada. */
export function checkBroadcastNow(mainWindow: BrowserWindow): Promise<void> {
  return fetchBroadcasts(mainWindow);
}
