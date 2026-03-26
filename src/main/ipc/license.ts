import { ipcMain, BrowserWindow, net } from 'electron';
import ElectronStore from 'electron-store';
import { getDeviceId } from '../services/device';
import { setLicenseKey } from '../services/error-reporter';

const store = new ElectronStore({
  name: 'infinit-license',
  encryptionKey: 'infinit-code-desktop-2026',
});

interface ValidateResponse {
  valid: boolean;
  plan?: string;
  expiresAt?: string;
  error?: string;
  reason?: string;       // 'device_limit' | 'expired' | 'invalid'
  deviceLimit?: number;
  activeDevices?: number;
}

async function validateOnline(key: string, email: string): Promise<ValidateResponse> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      key,
      email,
      deviceId: getDeviceId(),
    });

    const request = net.request({
      method: 'POST',
      url: 'https://app-infinitcode.netlify.app/api/license/validate',
      headers: { 'Content-Type': 'application/json' },
    });

    let responseData = '';

    const timeout = setTimeout(() => {
      request.abort?.();
      resolve({ valid: false, error: 'Tempo de conexão esgotado. Verifique sua internet.' });
    }, 10_000);

    request.on('response', (response) => {
      clearTimeout(timeout);
      response.on('data', (chunk) => { responseData += chunk.toString(); });
      response.on('end', () => {
        try {
          resolve(JSON.parse(responseData) as ValidateResponse);
        } catch {
          resolve({ valid: false, error: 'Resposta inválida do servidor' });
        }
      });
    });

    request.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ valid: false, error: error.message });
    });

    request.write(body);
    request.end();
  });
}

/** Formata mensagem de erro de device limit para o usuário. */
function deviceLimitMessage(active: number, limit: number): string {
  return `Limite de dispositivos atingido (${active}/${limit}). Desative um dispositivo em app-infinitcode.netlify.app/painel.`;
}

export function registerLicenseHandlers(mainWindow: BrowserWindow): void {

  ipcMain.handle('license:validate', async (_event, key: string, email: string) => {
    if (process.env.NODE_ENV === 'development' && process.env.DEV_LICENSE_BYPASS === '1') {
      store.set('license', {
        key, email, plan: 'pro', expiresAt: null,
        validatedAt: new Date().toISOString(), deviceId: getDeviceId(),
      });
      return { valid: true, plan: 'pro', expiresAt: null };
    }

    const result = await validateOnline(key, email);

    if (result.reason === 'device_limit') {
      return {
        valid: false,
        error: deviceLimitMessage(result.activeDevices ?? 0, result.deviceLimit ?? 1),
      };
    }

    if (result.valid) {
      store.set('license', {
        key, email,
        plan: result.plan,
        expiresAt: result.expiresAt,
        validatedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
      });
      setLicenseKey(key);
    }

    return result;
  });

  ipcMain.handle('license:get-stored', async () => {
    const license = store.get('license') as {
      key: string; email: string; plan: string;
      expiresAt?: string; validatedAt: string;
    } | undefined;

    if (!license) return null;

    const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
    const withinGrace = Date.now() - new Date(license.validatedAt).getTime() < GRACE_MS;
    const cached = { valid: true, key: license.key, email: license.email, plan: license.plan };

    const result = await validateOnline(license.key, license.email);

    if (result.reason === 'device_limit') {
      // Backend confirmou que este device foi revogado
      store.delete('license');
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('license:revoked', {
          reason: 'device_limit',
          message: deviceLimitMessage(result.activeDevices ?? 0, result.deviceLimit ?? 1),
        });
      }
      return null;
    }

    if (result.valid) {
      store.set('license', { ...license, validatedAt: new Date().toISOString() });
      setLicenseKey(license.key);
      return { ...cached, plan: result.plan || license.plan };
    }

    if (result.error) {
      // Falha de rede — mantém cache dentro do grace period
      return withinGrace ? cached : { ...cached, offline: true };
    }

    // Servidor respondeu valid: false sem reason — licença inválida
    store.delete('license');
    return null;
  });

  ipcMain.handle('license:clear', () => {
    store.delete('license');
  });

  // Expõe o deviceId para o renderer (ex: painel de conta)
  ipcMain.handle('device:get-id', () => getDeviceId());
}
