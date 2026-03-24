import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Diretório para segredos criptografados com safeStorage (Keychain/DPAPI/libsecret por baixo)
const SECRETS_DIR = path.join(os.homedir(), '.config', 'infinit-code', 'secrets');

function secretPath(key: string): string {
  return path.join(SECRETS_DIR, `${key}.enc`);
}

export function setSecret(key: string, value: string): void {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    fs.writeFileSync(secretPath(key), encrypted);
  } else {
    // Fallback: texto plano com permissão restrita (600) quando OS não tem keychain
    fs.writeFileSync(secretPath(key) + '.plain', value, { mode: 0o600 });
  }
}

export function getSecret(key: string): string | null {
  try {
    const encPath = secretPath(key);
    if (fs.existsSync(encPath)) {
      const buf = fs.readFileSync(encPath);
      return safeStorage.decryptString(buf);
    }
    // Fallback plain
    const plainPath = encPath + '.plain';
    if (fs.existsSync(plainPath)) return fs.readFileSync(plainPath, 'utf-8').trim();
  } catch { /* token inválido ou corrompido */ }
  return null;
}

export function deleteSecret(key: string): void {
  try { fs.unlinkSync(secretPath(key)); } catch { /* ok */ }
  try { fs.unlinkSync(secretPath(key) + '.plain'); } catch { /* ok */ }
}
