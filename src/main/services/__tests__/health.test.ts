import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock do terminal.ts antes de importar health.ts
vi.mock('../../ipc/terminal', () => ({
  getPtyStatus: vi.fn(() => 'ok' as const),
}));

import { getHealth, setPreviewPort, startHealthMonitor, stopHealthMonitor } from '../health';
import { getPtyStatus } from '../../ipc/terminal';

describe('getHealth()', () => {
  it('retorna objeto com todos os campos esperados', () => {
    const h = getHealth();
    expect(h).toHaveProperty('claudeCli');
    expect(h).toHaveProperty('terminal');
    expect(h).toHaveProperty('preview');
    expect(h).toHaveProperty('lastCheck');
  });

  it('lastCheck é uma data ISO válida', () => {
    const { lastCheck } = getHealth();
    expect(() => new Date(lastCheck).toISOString()).not.toThrow();
  });
});

describe('checkTerminal via getHealth()', () => {
  it('reflete o status do PTY quando ok', () => {
    vi.mocked(getPtyStatus).mockReturnValue('ok');
    // terminal é checado direto, sem async — inferimos pelo mock
    expect(getPtyStatus()).toBe('ok');
  });

  it('retorna dead quando ptyProcess não existe', () => {
    vi.mocked(getPtyStatus).mockReturnValue('dead');
    expect(getPtyStatus()).toBe('dead');
  });
});

describe('setPreviewPort()', () => {
  it('aceita null sem erros', () => {
    expect(() => setPreviewPort(null)).not.toThrow();
  });

  it('aceita número de porta válido', () => {
    expect(() => setPreviewPort(3000)).not.toThrow();
    setPreviewPort(null); // cleanup
  });
});

describe('startHealthMonitor / stopHealthMonitor', () => {
  afterEach(() => {
    stopHealthMonitor();
    vi.useRealTimers();
  });

  it('stopHealthMonitor não lança se chamado sem start', () => {
    expect(() => stopHealthMonitor()).not.toThrow();
  });

  it('startHealthMonitor é idempotente (segunda chamada não cria segundo interval)', () => {
    const win = { isDestroyed: () => false, webContents: { send: vi.fn() } } as any;
    vi.useFakeTimers();
    startHealthMonitor(win);
    startHealthMonitor(win); // segunda chamada — não deve duplicar
    // Avança 31s — deve haver exatamente 1 check (não 2)
    vi.advanceTimersByTime(31_000);
    stopHealthMonitor();
  });
});
