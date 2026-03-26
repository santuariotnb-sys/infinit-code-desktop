import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FILE_LIMITS } from '../constants';

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

const MAX_FILE_SIZE = FILE_LIMITS.MAX_READ_BYTES;

const BINARY_EXTENSIONS = new Set([
  'png','jpg','jpeg','gif','webp','bmp','ico','svg',
  'mp4','mp3','wav','ogg','webm','avi','mov','mkv',
  'zip','tar','gz','rar','7z','bz2',
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
  'exe','dll','so','dylib','bin','wasm',
  'ttf','otf','woff','woff2','eot',
  'db','sqlite','sqlite3',
]);

function isBinaryPath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  return BINARY_EXTENSIONS.has(ext);
}

let watcher: fs.FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

function readDirRecursive(
  dirPath: string,
  depth: number = 0,
  maxDepth: number = FILE_LIMITS.DIR_MAX_DEPTH,
  visitedInodes: Set<number> = new Set(),
): FileNode[] {
  if (depth >= maxDepth) return [];

  try {
    // Guarda inode para detectar symlink loops
    const dirStat = fs.statSync(dirPath);
    if (visitedInodes.has(dirStat.ino)) return [];
    visitedInodes.add(dirStat.ino);

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
          children: readDirRecursive(fullPath, depth + 1, maxDepth, visitedInodes),
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

  // Reject path traversal sequences before resolving
  if (filePath.includes('..')) return false;

  if (allowedRoot) {
    const root = path.resolve(allowedRoot);
    return resolved === root || resolved.startsWith(root + path.sep);
  }

  // Block sensitive system directories
  const BLOCKED_PREFIXES = process.platform === 'win32'
    ? ['C:\\Windows\\', 'C:\\System32\\', 'C:\\Program Files\\']
    : ['/etc/', '/var/', '/usr/', '/bin/', '/sbin/', '/boot/', '/proc/', '/sys/',
       '/private/etc/', '/private/var/'];

  if (BLOCKED_PREFIXES.some((b) => resolved.startsWith(b))) return false;

  // Reject symlinks pointing outside home (com normalização para evitar traversal)
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      const real = path.normalize(fs.realpathSync(resolved));
      const home = path.normalize(path.resolve(os.homedir())) + path.sep;
      if (!real.startsWith(home) && real !== home.slice(0, -1)) return false;
    }
  } catch { /* path doesn't exist yet — allow (write case) */ }

  return true;
}

// ── Route scanner (Next.js App Router + Pages Router) ──────────────

interface RouteEntry {
  route: string;
  filePath: string;
  type: 'page' | 'layout' | 'api';
}

const PAGE_FILES = new Set(['page.tsx', 'page.jsx', 'page.js', 'page.ts']);
const LAYOUT_FILES = new Set(['layout.tsx', 'layout.jsx', 'layout.js', 'layout.ts']);
const ROUTE_FILES = new Set(['route.tsx', 'route.jsx', 'route.js', 'route.ts']);

function scanAppRouter(appDir: string, prefix = ''): RouteEntry[] {
  const routes: RouteEntry[] = [];
  try {
    const entries = fs.readdirSync(appDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(appDir, entry.name);
      if (entry.isFile()) {
        if (PAGE_FILES.has(entry.name)) {
          routes.push({ route: prefix || '/', filePath: fullPath, type: 'page' });
        } else if (LAYOUT_FILES.has(entry.name) && prefix) {
          routes.push({ route: prefix, filePath: fullPath, type: 'layout' });
        } else if (ROUTE_FILES.has(entry.name)) {
          routes.push({ route: prefix || '/', filePath: fullPath, type: 'api' });
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          routes.push(...scanAppRouter(fullPath, prefix));
        } else {
          routes.push(...scanAppRouter(fullPath, `${prefix}/${entry.name}`));
        }
      }
    }
  } catch { /* dir may not exist */ }
  return routes;
}

function scanPagesRouter(pagesDir: string, prefix = ''): RouteEntry[] {
  const routes: RouteEntry[] = [];
  try {
    const entries = fs.readdirSync(pagesDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(pagesDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.name === 'node_modules') {
          if (entry.name === 'api') {
            routes.push(...scanPagesRouter(fullPath, `${prefix}/api`).map(r => ({ ...r, type: 'api' as const })));
          }
          continue;
        }
        routes.push(...scanPagesRouter(fullPath, `${prefix}/${entry.name}`));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!['.tsx', '.jsx', '.js', '.ts'].includes(ext)) continue;
        const base = path.basename(entry.name, ext);
        if (base.startsWith('_')) continue;
        const route = base === 'index' ? (prefix || '/') : `${prefix}/${base}`;
        routes.push({ route, filePath: fullPath, type: 'page' });
      }
    }
  } catch { /* dir may not exist */ }
  return routes;
}

function scanProjectRoutes(projectPath: string): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const candidate of ['app', 'src/app']) {
    const appDir = path.join(projectPath, candidate);
    if (fs.existsSync(appDir)) routes.push(...scanAppRouter(appDir));
  }
  for (const candidate of ['pages', 'src/pages']) {
    const pagesDir = path.join(projectPath, candidate);
    if (fs.existsSync(pagesDir)) routes.push(...scanPagesRouter(pagesDir));
  }
  const seen = new Map<string, RouteEntry>();
  for (const r of routes) {
    const existing = seen.get(r.route);
    if (!existing || (r.type === 'page' && existing.type !== 'page')) {
      seen.set(r.route, r);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.route.localeCompare(b.route));
}

export function registerFileHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      if (!isPathSafe(filePath)) {
        return { ok: false, error: 'Acesso negado a este caminho' };
      }
      if (isBinaryPath(filePath)) {
        return { ok: false, error: 'Arquivo binário não pode ser aberto no editor', isBinary: true };
      }
      const stat = await fs.promises.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) {
        const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
        return { ok: false, error: `Arquivo muito grande (${sizeMB} MB). Limite: 10 MB`, isTooLarge: true };
      }
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    try {
      if (!isPathSafe(filePath)) {
        return { ok: false, error: 'Acesso negado a este caminho' };
      }
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('file:readdir', async (_event, dirPath: string) => {
    try {
      if (!isPathSafe(dirPath)) {
        return { ok: false, error: 'Acesso negado a este caminho' };
      }
      const data = readDirRecursive(dirPath);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
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

  ipcMain.handle('file:mkdir', async (_event, dirPath: string) => {
    try {
      if (!isPathSafe(dirPath)) {
        return { ok: false, error: 'Acesso negado a este caminho' };
      }
      await fs.promises.mkdir(dirPath, { recursive: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('file:exists', (_event, filePath: string) => {
    try {
      return { ok: true, exists: fs.existsSync(filePath) };
    } catch {
      return { ok: true, exists: false };
    }
  });

  ipcMain.handle('file:unwatch', () => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  });

  ipcMain.handle('file:watch', (_event, dirPath: string) => {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
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
        }, FILE_LIMITS.WATCHER_DEBOUNCE_MS);
      });
    } catch {
      // directory may not exist yet
    }
  });

  ipcMain.handle('file:scan-routes', async (_event, projectPath: string) => {
    try {
      if (!isPathSafe(projectPath)) {
        return { ok: false, error: 'Acesso negado', routes: [] };
      }
      const routes = scanProjectRoutes(projectPath);
      return { ok: true, routes };
    } catch (error) {
      return { ok: false, error: (error as Error).message, routes: [] };
    }
  });
}
