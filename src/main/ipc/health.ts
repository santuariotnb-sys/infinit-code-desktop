import { ipcMain } from 'electron';
import { getHealth, setPreviewPort } from '../services/health';

export function registerHealthHandlers(): void {
  ipcMain.handle('health:get', () => {
    try {
      return { ok: true, data: getHealth() };
    } catch (error) {
      console.error('[health:get]', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('health:set-preview-port', (_event, port: number | null) => {
    try {
      setPreviewPort(port);
      return { ok: true };
    } catch (error) {
      console.error('[health:set-preview-port]', error);
      return { ok: false, error: (error as Error).message };
    }
  });
}
