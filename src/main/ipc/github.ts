import { ipcMain } from 'electron';
import { execSync, exec } from 'child_process';

export function registerGithubHandlers(): void {
  ipcMain.handle('github:check-installed', () => {
    try {
      const cmd = process.platform === 'win32' ? 'where git' : 'which git';
      execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
      const version = execSync('git --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false };
    }
  });

  ipcMain.handle('github:clone', (_event, url: string, dest: string) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      // Validate URL
      if (!/^https?:\/\/.+\.git$|^git@.+:.+\.git$|^https?:\/\/github\.com\/.+/.test(url)) {
        resolve({ success: false, error: 'URL inválida' });
        return;
      }

      exec(`git clone "${url}" "${dest}"`, { timeout: 120000 }, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  ipcMain.handle('github:status', (_event, cwd: string) => {
    try {
      const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8', timeout: 5000 });
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
      return {
        isRepo: true,
        branch,
        changes: status.split('\n').filter(Boolean).map(line => ({
          status: line.substring(0, 2).trim(),
          file: line.substring(3),
        })),
      };
    } catch {
      return { isRepo: false, branch: '', changes: [] };
    }
  });
}
