/**
 * Teste de smoke — valida que a infraestrutura de testes está funcionando.
 * Testa: mocks de electron e electron-store, globals do vitest, TypeScript.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app, ipcMain, BrowserWindow } from 'electron';
import ElectronStore from 'electron-store';

describe('Infraestrutura de testes', () => {
  describe('Mock do Electron', () => {
    it('app.getVersion retorna a versão mockada', () => {
      expect(app.getVersion()).toBe('1.2.31');
    });

    it('ipcMain.handle é uma função mockável', () => {
      ipcMain.handle('test:channel', async () => ({ ok: true }));
      expect(ipcMain.handle).toHaveBeenCalledWith('test:channel', expect.any(Function));
    });

    it('BrowserWindow instancia sem erros', () => {
      const win = new (BrowserWindow as any)();
      expect(win.isDestroyed()).toBe(false);
      expect(win.webContents.send).toBeInstanceOf(Function);
    });
  });

  describe('Mock do ElectronStore', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let store: InstanceType<typeof ElectronStore>;

    beforeEach(() => {
      store = new ElectronStore() as any;
      (store as any)._reset?.();
    });

    it('get retorna defaultValue quando chave não existe', () => {
      const val = (store as any).get('inexistente', 'default');
      expect(val).toBe('default');
    });

    it('set persiste e get recupera o valor', () => {
      (store as any).set('chave', { dados: 42 });
      expect((store as any).get('chave')).toEqual({ dados: 42 });
    });

    it('delete remove a chave', () => {
      (store as any).set('temp', 'valor');
      (store as any).delete('temp');
      expect((store as any).get('temp', null)).toBeNull();
    });
  });

  describe('Ambiente Node.js', () => {
    it('os e crypto estão disponíveis', async () => {
      const os = await import('node:os');
      const crypto = await import('node:crypto');
      expect(typeof os.hostname()).toBe('string');
      expect(typeof crypto.createHash).toBe('function');
    });

    it('globals do vitest estão acessíveis', () => {
      const spy = vi.fn(() => 'ok');
      expect(spy()).toBe('ok');
      expect(spy).toHaveBeenCalledOnce();
    });
  });
});
