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
    onInject: (cb: (text: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, t: string) => cb(t);
      ipcRenderer.on('terminal:inject', handler);
      return () => ipcRenderer.removeListener('terminal:inject', handler);
    },
  },

  files: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    readDir: (dirPath: string) => ipcRenderer.invoke('file:readdir', dirPath),
    openDialog: () => ipcRenderer.invoke('file:open-dialog'),
    getHome: () => ipcRenderer.invoke('file:home'),
    watch: (dirPath: string) => ipcRenderer.invoke('file:watch', dirPath),
    unwatch: () => ipcRenderer.invoke('file:unwatch'),
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
    voiceStatus: () => ipcRenderer.invoke('claude:voice-status'),
    voiceStart: () => ipcRenderer.invoke('claude:voice-start'),
    writeVoiceSettings: () => ipcRenderer.invoke('claude:write-voice-settings'),
    ask: (payload: { prompt: string; cwd: string; sessionId?: string }) =>
      ipcRenderer.invoke('claude:ask', payload),
    clearSession: () => ipcRenderer.invoke('claude:clear-session'),
    status: () => ipcRenderer.invoke('claude:status'),
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
    onChunk: (cb: (data: { text: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { text: string }) => cb(data);
      ipcRenderer.on('claude:chunk', handler);
      return () => ipcRenderer.removeListener('claude:chunk', handler);
    },
    onTool: (cb: (data: { name: string; input: unknown }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { name: string; input: unknown }) => cb(data);
      ipcRenderer.on('claude:tool', handler);
      return () => ipcRenderer.removeListener('claude:tool', handler);
    },
    onError: (cb: (data: { message: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { message: string }) => cb(data);
      ipcRenderer.on('claude:error', handler);
      return () => ipcRenderer.removeListener('claude:error', handler);
    },
  },

  github: {
    checkInstalled: () => ipcRenderer.invoke('github:check-installed'),
    connectOAuth: () => Promise.resolve({ connected: false, error: 'deprecated' }), // kept for type compat
    deviceFlowStart: () => ipcRenderer.invoke('github:device-flow-start'),
    deviceFlowPoll: (deviceCode: string, interval: number) => ipcRenderer.invoke('github:device-flow-poll', deviceCode, interval),
    savePat: (token: string) => ipcRenderer.invoke('github:save-pat', token),
    authStatus: () => ipcRenderer.invoke('github:auth-status'),
    disconnect: () => ipcRenderer.invoke('github:disconnect'),
    onDeviceFlowProgress: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('github:device-flow-progress', handler);
      return () => ipcRenderer.removeListener('github:device-flow-progress', handler);
    },
    clone: (repo: string, dest: string) => ipcRenderer.invoke('github:clone', repo, dest),
    listRepos: () => ipcRenderer.invoke('github:list-repos'),
    gitStatus: (cwd: string) => ipcRenderer.invoke('github:git-status', cwd),
    commit: (cwd: string, message: string) => ipcRenderer.invoke('github:commit', cwd, message),
    sync: (cwd: string, branch: string) => ipcRenderer.invoke('github:sync', cwd, branch),
    pull: (cwd: string, branch: string) => ipcRenderer.invoke('github:pull', cwd, branch),
    push: (cwd: string, branch: string) => ipcRenderer.invoke('github:push', cwd, branch),
    branches: (cwd: string) => ipcRenderer.invoke('github:branches', cwd),
    createBranch: (cwd: string, name: string) => ipcRenderer.invoke('github:create-branch', cwd, name),
    watchForChanges: (projectPath: string) => ipcRenderer.invoke('github:watch-for-changes', projectPath),
    onSyncProgress: (cb: (data: { step?: string; msg?: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { step?: string; msg?: string }) => cb(d);
      ipcRenderer.on('github:sync-progress', handler);
      return () => ipcRenderer.removeListener('github:sync-progress', handler);
    },
    onLocalChanges: (cb: (files: string[]) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { files: string[] }) => cb(d.files);
      ipcRenderer.on('github:local-changes', handler);
      return () => ipcRenderer.removeListener('github:local-changes', handler);
    },
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
    onProgress: (cb: (data: { step: string; pct: number; msg: string; status: 'active' | 'done' | 'error' }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { step: string; pct: number; msg: string; status: 'active' | 'done' | 'error' }) => cb(d);
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
    onNeedGit: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('setup:need-git', handler);
      return () => ipcRenderer.removeListener('setup:need-git', handler);
    },
    onNeedClaude: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('setup:need-claude', handler);
      return () => ipcRenderer.removeListener('setup:need-claude', handler);
    },
  },

  auth: {
    loginGithub: () => ipcRenderer.invoke('auth:github'),
    githubDeviceStart: () => ipcRenderer.invoke('auth:github-device-start'),
    githubDevicePoll: (deviceCode: string, interval: number) => ipcRenderer.invoke('auth:github-device-poll', deviceCode, interval),
    loginGithubPat: (token: string) => ipcRenderer.invoke('auth:github-pat', token),
    loginGoogle: () => ipcRenderer.invoke('auth:google'),
    saveGoogleCreds: (clientId: string, clientSecret: string) => ipcRenderer.invoke('auth:save-google-creds', clientId, clientSecret),
    googleStatus: () => ipcRenderer.invoke('auth:google-status'),
    getSession: () => ipcRenderer.invoke('auth:session'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },

  screenshot: () => ipcRenderer.invoke('window:screenshot'),
});
