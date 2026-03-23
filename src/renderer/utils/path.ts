export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function dirname(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  parts.pop();
  return parts.join('/') || '.';
}
