import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const IGNORE_LIST = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '.DS_Store', '.webpack', '__pycache__', '.cache',
  'coverage', '.nyc_output',
]);

let watcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

function readDirRecursive(dirPath: string, depth: number = 0, maxDepth: number = 3): FileNode[] {
  if (depth >= maxDepth) return [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result: FileNode[] = [];

    const sorted = entries
      .filter(e => !IGNORE_LIST.has(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'folder',
          children: readDirRecursive(fullPath, depth + 1, maxDepth),
        });
      } else {
        result.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

function isPathSafe(filePath: string, allowedRoot?: string): boolean {
  const resolved = path.resolve(filePath);
  if (allowedRoot) {
    return resolved.startsWith(path.resolve(allowedRoot));
  }
  // Block access to sensitive system paths
  const blocked = ['/etc/shadow', '/etc/passwd'];
  return !blocked.some(b => resolved.startsWith(b));
}

export function registerFileHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    if (!isPathSafe(filePath)) {
      throw new Error('Acesso negado a este caminho');
    }
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    if (!isPathSafe(filePath)) {
      throw new Error('Acesso negado a este caminho');
    }
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('file:readdir', async (_event, dirPath: string) => {
    if (!isPathSafe(dirPath)) {
      throw new Error('Acesso negado a este caminho');
    }
    return readDirRecursive(dirPath);
  });

  ipcMain.handle('file:open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Abrir pasta do projeto',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('file:home', () => {
    return os.homedir();
  });

  ipcMain.handle('file:watch', (_event, dirPath: string) => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }

    try {
      watcher = fs.watch(dirPath, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        if (IGNORE_LIST.has(filename.split(path.sep)[0])) return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const fullPath = path.join(dirPath, filename);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file:changed', fullPath);
          }
        }, 300);
      });
    } catch {
      // directory may not exist yet
    }
  });
}
