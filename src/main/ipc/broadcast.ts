import { ipcMain } from 'electron';
import { getActiveBroadcasts, dismissBroadcast } from '../services/broadcast';

export function registerBroadcastHandlers(): void {
  ipcMain.handle('broadcast:get', () => {
    try {
      return { ok: true, data: getActiveBroadcasts() };
    } catch (error) {
      console.error('[broadcast:get]', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('broadcast:dismiss', (_event, id: string) => {
    try {
      dismissBroadcast(id);
      return { ok: true };
    } catch (error) {
      console.error('[broadcast:dismiss]', error);
      return { ok: false, error: (error as Error).message };
    }
  });
}
