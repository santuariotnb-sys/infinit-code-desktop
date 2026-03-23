import * as keytar from 'keytar';

const SERVICE_NAME = 'infinit-code-desktop';

export async function setSecret(key: string, value: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, value);
}

export async function getSecret(key: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, key);
}

export async function deleteSecret(key: string): Promise<boolean> {
  return keytar.deletePassword(SERVICE_NAME, key);
}
