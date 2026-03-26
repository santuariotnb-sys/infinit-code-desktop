import { vi } from 'vitest';

// Precisa ser function (não arrow) para suportar `new ElectronStore()`
const MockElectronStore = vi.fn(function MockElectronStore(this: Record<string, unknown>) {
  const map = new Map<string, unknown>();

  this.get = vi.fn((key: string, defaultValue?: unknown) =>
    map.has(key) ? map.get(key) : defaultValue
  );
  this.set = vi.fn((key: string, value: unknown) => { map.set(key, value); });
  this.delete = vi.fn((key: string) => { map.delete(key); });
  this.has = vi.fn((key: string) => map.has(key));
  this.clear = vi.fn(() => { map.clear(); });
  // Helper para resetar estado entre testes
  this._reset = () => { map.clear(); };
});

export default MockElectronStore;
