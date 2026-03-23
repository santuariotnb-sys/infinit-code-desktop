import { BrowserWindow } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

export function initUpdater(_mainWindow: BrowserWindow): void {
  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: 'santuariotnb-sys/infinit-code-desktop',
      },
      updateInterval: '1 hour',
      notifyUser: true,
    });
  } catch {
    // updater may fail in dev mode
  }
}
