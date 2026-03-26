import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDeviceId, getDeviceId } from '../device';

// electron-store é mockado via alias no vitest.config.ts
let storeInstance: ReturnType<typeof import('../__tests__/__mocks__/electron-store').default>;

vi.mock('electron-store', async () => {
  const MockStore = (await import('./__mocks__/electron-store')).default;
  return { default: MockStore };
});

beforeEach(async () => {
  // Reseta o store entre testes para isolar estado
  vi.resetModules();
});

describe('generateDeviceId()', () => {
  it('retorna uma string de exatamente 32 caracteres', () => {
    const id = generateDeviceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(32);
  });

  it('retorna apenas caracteres hexadecimais', () => {
    const id = generateDeviceId();
    expect(/^[0-9a-f]{32}$/.test(id)).toBe(true);
  });

  it('é determinístico — duas chamadas retornam o mesmo valor', () => {
    expect(generateDeviceId()).toBe(generateDeviceId());
  });

  it('não lança exceção mesmo se os.cpus() retornar array vazio', () => {
    const os = require('node:os');
    vi.spyOn(os, 'cpus').mockReturnValueOnce([]);
    expect(() => generateDeviceId()).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('getDeviceId()', () => {
  it('retorna string hexadecimal de 32 chars', () => {
    const id = getDeviceId();
    expect(/^[0-9a-f]{32}$/.test(id)).toBe(true);
  });

  it('é determinístico entre chamadas na mesma sessão', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });
});
