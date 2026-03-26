import { vi } from 'vitest';

export const app = {
  getVersion: vi.fn(() => '1.2.31'),
  getPath: vi.fn((name: string) => `/tmp/infinit-test/${name}`),
  isReady: vi.fn(() => true),
};

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  removeHandler: vi.fn(),
};

// Precisa ser function (não arrow) para suportar `new BrowserWindow()`
export const BrowserWindow = vi.fn(function BrowserWindow(this: Record<string, unknown>) {
  this.id = 1;
  this.isDestroyed = vi.fn(() => false);
  this.webContents = { send: vi.fn() };
});

export const shell = {
  openExternal: vi.fn(),
};

export const dialog = {
  showMessageBox: vi.fn(),
};
