import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch global antes de importar o módulo
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.2.31') },
}));

vi.mock('../device', () => ({
  getDeviceId: vi.fn(() => 'abcd1234abcd1234abcd1234abcd1234'),
}));

import { reportError, setLicenseKey } from '../error-reporter';

// Aguarda o fire-and-forget (void sendReport) resolver via microtask flush
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  mockFetch.mockClear();
  vi.resetModules();
});

describe('reportError()', () => {
  it('chama fetch com os campos obrigatórios', async () => {
    reportError({ type: 'ipc_error', message: 'algo falhou' });
    await flush();
    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('ipc_error');
    expect(body.message).toBe('algo falhou');
    expect(body.version).toBe('1.2.31');
    expect(body.deviceId).toBe('abcd1234abcd1234abcd1234abcd1234');
    expect(body.timestamp).toBeTruthy();
  });

  it('trunca messages muito longas em 1000 chars', async () => {
    const long = 'x'.repeat(2000);
    reportError({ type: 'crash', message: long });
    await flush();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message.length).toBeLessThanOrEqual(1000);
  });

  it('não lança se fetch falhar', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    expect(() => reportError({ type: 'uncaught', message: 'boom' })).not.toThrow();
    await flush();
    // Nenhum erro propagado — silent catch em sendReport
  });

  it('inclui licenseKey quando definida via setLicenseKey', async () => {
    setLicenseKey('INFT-TEST-1234');
    reportError({ type: 'setup_error', message: 'test' });
    await flush();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.licenseKey).toBe('INFT-TEST-1234');
  });
});

describe('rate limit', () => {
  it('não envia mais de 10 reports por minuto', async () => {
    const { reportError: re } = await import('../error-reporter');
    for (let i = 0; i < 15; i++) {
      re({ type: 'ipc_error', message: `erro ${i}` });
    }
    await flush();
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
