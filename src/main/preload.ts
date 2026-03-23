import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
    write: (data: string) => ipcRenderer.invoke('terminal:write', data),
    resize: (cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', cols, rows),
    kill: () => ipcRenderer.invoke('terminal:kill'),
    onData: (cb: (data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: string) => cb(d);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
  },

  files: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    readDir: (dirPath: string) => ipcRenderer.invoke('file:readdir', dirPath),
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    getHome: () => ipcRenderer.invoke('file:home'),
    watch: (dirPath: string) => ipcRenderer.invoke('file:watch', dirPath),
    onChanged: (cb: (filePath: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, p: string) => cb(p);
      ipcRenderer.on('file:changed', handler);
      return () => ipcRenderer.removeListener('file:changed', handler);
    },
  },

  claude: {
    checkInstalled: () => ipcRenderer.invoke('claude:check-installed'),
    install: () => ipcRenderer.invoke('claude:install'),
    checkAuth: () => ipcRenderer.invoke('claude:check-auth'),
    openAuth: () => ipcRenderer.invoke('claude:open-auth'),
    installSkills: () => ipcRenderer.invoke('claude:install-skills'),
    onInstallProgress: (cb: (data: { pct: number; msg: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { pct: number; msg: string }) => cb(d);
      ipcRenderer.on('claude:install-progress', handler);
      return () => ipcRenderer.removeListener('claude:install-progress', handler);
    },
    onAuthenticated: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('claude:authenticated', handler);
      return () => ipcRenderer.removeListener('claude:authenticated', handler);
    },
  },

  github: {
    checkInstalled: () => ipcRenderer.invoke('github:check-installed'),
    clone: (url: string, dest: string) => ipcRenderer.invoke('github:clone', url, dest),
    getStatus: (cwd: string) => ipcRenderer.invoke('github:status', cwd),
  },

  license: {
    validate: (key: string, email: string) => ipcRenderer.invoke('license:validate', key, email),
    getStored: () => ipcRenderer.invoke('license:get-stored'),
    clear: () => ipcRenderer.invoke('license:clear'),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    onUpdateAvailable: (cb: (version: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, v: string) => cb(v);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  },

  setup: {
    onProgress: (cb: (data: { step: string; pct: number; msg: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { step: string; pct: number; msg: string }) => cb(d);
      ipcRenderer.on('setup:progress', handler);
      return () => ipcRenderer.removeListener('setup:progress', handler);
    },
    onComplete: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('setup:complete', handler);
      return () => ipcRenderer.removeListener('setup:complete', handler);
    },
    onNeedNode: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('setup:need-node', handler);
      return () => ipcRenderer.removeListener('setup:need-node', handler);
    },
  },
});
