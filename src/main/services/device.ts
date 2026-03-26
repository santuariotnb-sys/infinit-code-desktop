/**
 * device.ts — Identificação estável e única por máquina.
 * Usado pelo sistema de device binding de licença.
 */

import os from 'node:os';
import crypto from 'node:crypto';
import ElectronStore from 'electron-store';

const store = new ElectronStore<{ deviceId: string }>({ name: 'infinit-device' });

/**
 * Gera um deviceId determinístico baseado em características da máquina.
 * Usa os mesmos campos do getMachineId() em license.ts para compatibilidade,
 * mais arch e CPU model para maior unicidade.
 * Retorna 32 chars hexadecimais.
 */
export function generateDeviceId(): string {
  const cpuModel = os.cpus()[0]?.model ?? 'unknown';
  const raw = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    cpuModel,
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

/**
 * Retorna o deviceId persistido no store.
 * Na primeira chamada, gera e persiste. Em seguida, sempre retorna o mesmo valor —
 * mesmo que os.hostname() mude (ex: usuário renomeia a máquina).
 */
export function getDeviceId(): string {
  const stored = store.get('deviceId');
  if (stored && stored.length === 32) return stored;
  const id = generateDeviceId();
  store.set('deviceId', id);
  return id;
}
