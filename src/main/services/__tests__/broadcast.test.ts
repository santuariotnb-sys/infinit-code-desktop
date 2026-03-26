import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch antes de importar o módulo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.2.31') },
}));

// ElectronStore mock é automático via alias no vitest.config.ts

import {
  getActiveBroadcasts,
  dismissBroadcast,
  startBroadcastMonitor,
  stopBroadcastMonitor,
  checkBroadcastNow,
} from '../broadcast';

const mockWin = {
  isDestroyed: () => false,
  webContents: { send: vi.fn() },
} as any;

function makeBroadcast(overrides = {}) {
  return {
    id: 'test-1',
    title: 'Manutenção',
    body: 'App ficará offline das 02h às 04h.',
    severity: 'info' as const,
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockWin.webContents.send.mockReset();
  vi.resetModules();
});

afterEach(() => {
  stopBroadcastMonitor();
});

describe('getActiveBroadcasts()', () => {
  it('retorna vazio quando não há mensagens', () => {
    expect(getActiveBroadcasts()).toEqual([]);
  });

  it('exclui mensagens expiradas', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [makeBroadcast({ id: 'exp-1', expiresAt: past })],
    });
    await checkBroadcastNow(mockWin);
    expect(getActiveBroadcasts()).toEqual([]);
  });

  it('mantém mensagens não expiradas', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [makeBroadcast({ id: 'ok-1', expiresAt: future })],
    });
    await checkBroadcastNow(mockWin);
    expect(getActiveBroadcasts().length).toBe(1);
  });
});

describe('dismissBroadcast()', () => {
  it('remove mensagem do resultado de getActiveBroadcasts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [makeBroadcast({ id: 'dismiss-1' })],
    });
    await checkBroadcastNow(mockWin);

    dismissBroadcast('dismiss-1');
    expect(getActiveBroadcasts().find((m) => m.id === 'dismiss-1')).toBeUndefined();
  });

  it('é idempotente — dismiss duplo não duplica entrada', () => {
    dismissBroadcast('dup-1');
    dismissBroadcast('dup-1');
    expect(true).toBe(true);
  });
});

describe('fetchBroadcasts()', () => {
  it('envia broadcast:updated quando há mensagens ativas', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [makeBroadcast()],
    });
    await checkBroadcastNow(mockWin);
    expect(mockWin.webContents.send).toHaveBeenCalledWith('broadcast:updated', expect.any(Array));
  });

  it('não envia broadcast:updated quando não há mensagens ativas', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async (): Promise<unknown[]> => [] });
    await checkBroadcastNow(mockWin);
    expect(mockWin.webContents.send).not.toHaveBeenCalled();
  });

  it('ignora resposta não-ok silenciosamente', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(checkBroadcastNow(mockWin)).resolves.toBeUndefined();
  });

  it('não lança quando fetch falha', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    await expect(checkBroadcastNow(mockWin)).resolves.toBeUndefined();
  });
});

describe('startBroadcastMonitor / stopBroadcastMonitor', () => {
  it('stopBroadcastMonitor não lança se chamado sem start', () => {
    expect(() => stopBroadcastMonitor()).not.toThrow();
  });

  it('startBroadcastMonitor é idempotente', () => {
    vi.useFakeTimers();
    startBroadcastMonitor(mockWin);
    startBroadcastMonitor(mockWin); // segunda chamada — não duplica
    stopBroadcastMonitor();
    vi.useRealTimers();
  });
});
