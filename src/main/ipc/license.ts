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

    // Timeout de 10s para não travar o app
    const timeout = setTimeout(() => {
      request.abort?.();
      resolve({ valid: false, error: 'Tempo de conexão esgotado. Verifique sua internet.' });
    }, 10_000);

    request.on('response', (response) => {
      clearTimeout(timeout);
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
      clearTimeout(timeout);
      resolve({ valid: false, error: error.message });
    });

    request.write(body);
    request.end();
  });
}

export function registerLicenseHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('license:validate', async (_event, key: string, email: string) => {
    if (process.env.NODE_ENV === 'development' && process.env.DEV_LICENSE_BYPASS === '1') {
      const bypass: { valid: boolean; plan: string; expiresAt: string | null } = { valid: true, plan: 'pro', expiresAt: null };
      store.set('license', {
        key,
        email,
        plan: 'pro',
        expiresAt: null,
        validatedAt: new Date().toISOString(),
        deviceId: getMachineId(),
      });
      return bypass;
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

    const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const lastValidated = license.validatedAt ? new Date(license.validatedAt).getTime() : 0;
    const withinGrace = Date.now() - lastValidated < GRACE_MS;

    const cached = { valid: true, key: license.key, email: license.email, plan: license.plan };

    // Re-validate silently
    const result = await validateOnline(license.key, license.email);

    if (result.valid) {
      // Atualiza timestamp de validação
      store.set('license', { ...license, validatedAt: new Date().toISOString() });
      return { ...cached, plan: result.plan || license.plan };
    }

    if (result.error) {
      // Falha de rede ou servidor fora do ar — não apaga a licença
      if (withinGrace) return cached;
      // Fora do grace period e sem acesso ao servidor
      return { ...cached, offline: true };
    }

    // Servidor respondeu explicitamente que a licença é inválida
    store.delete('license');
    return null;
  });

  ipcMain.handle('license:clear', () => {
    store.delete('license');
  });
}
