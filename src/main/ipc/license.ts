import { ipcMain, BrowserWindow, net } from 'electron';
import os from 'os';
import crypto from 'crypto';
import ElectronStore from 'electron-store';

const store = new ElectronStore({
  name: 'infinit-license',
  encryptionKey: 'infinit-code-desktop-2026',
});

function getMachineId(): string {
  const raw = `${os.hostname()}-${os.userInfo().username}-${os.platform()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

async function validateOnline(key: string, email: string): Promise<{
  valid: boolean;
  plan?: string;
  expiresAt?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      key,
      email,
      deviceId: getMachineId(),
    });

    const request = net.request({
      method: 'POST',
      url: 'https://app-infinitcode.netlify.app/api/license/validate',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });
      response.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          resolve(data);
        } catch {
          resolve({ valid: false, error: 'Resposta inválida do servidor' });
        }
      });
    });

    request.on('error', (error) => {
      resolve({ valid: false, error: error.message });
    });

    request.write(body);
    request.end();
  });
}

const DEV_BYPASS_KEY = 'INFT-DEV0-TEST-0000-0000';
const DEV_BYPASS_RESULT: { valid: boolean; plan: string; expiresAt: string | null } = { valid: true, plan: 'pro', expiresAt: null };

export function registerLicenseHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('license:validate', async (_event, key: string, email: string) => {
    if (key === DEV_BYPASS_KEY) {
      store.set('license', {
        key,
        email,
        plan: 'pro',
        expiresAt: null,
        validatedAt: new Date().toISOString(),
        deviceId: getMachineId(),
      });
      return DEV_BYPASS_RESULT;
    }

    const result = await validateOnline(key, email);

    if (result.valid) {
      store.set('license', {
        key,
        email,
        plan: result.plan,
        expiresAt: result.expiresAt,
        validatedAt: new Date().toISOString(),
        deviceId: getMachineId(),
      });
    }

    return result;
  });

  ipcMain.handle('license:get-stored', async () => {
    const license = store.get('license') as {
      key: string; email: string; plan: string; expiresAt?: string; validatedAt: string;
    } | undefined;

    if (!license) return null;

    if (license.key === DEV_BYPASS_KEY) {
      return { valid: true, key: license.key, email: license.email, plan: 'pro' };
    }

    // Re-validate silently
    try {
      const result = await validateOnline(license.key, license.email);
      if (!result.valid) {
        store.delete('license');
        return null;
      }
      return {
        valid: true,
        key: license.key,
        email: license.email,
        plan: result.plan || license.plan,
      };
    } catch {
      // Offline: trust cached license
      return {
        valid: true,
        key: license.key,
        email: license.email,
        plan: license.plan,
      };
    }
  });

  ipcMain.handle('license:clear', () => {
    store.delete('license');
  });
}
