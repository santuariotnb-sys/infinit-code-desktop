import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
    write: (data: string) => ipcRenderer.invoke('terminal:write', data),
    resize: (cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', cols, rows),
    kill: () => ipcRenderer.invoke('terminal:kill'),
    restart: (cwd?: string) => ipcRenderer.invoke('terminal:restart', cwd),
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
    onExit: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
    ghost: {
      create: (cwd: string) => ipcRenderer.invoke('terminal:ghost:create', cwd),
      write: (data: string) => ipcRenderer.invoke('terminal:ghost:write', data),
      kill: () => ipcRenderer.invoke('terminal:ghost:kill'),
      onData: (cb: (data: string) => void) => {
        const handler = (_: Electron.IpcRendererEvent, d: string) => cb(d);
        ipcRenderer.on('terminal:ghost:data', handler);
        return () => ipcRenderer.removeListener('terminal:ghost:data', handler);
      },
      onExit: (cb: () => void) => {
        const handler = () => cb();
        ipcRenderer.on('terminal:ghost:exit', handler);
        return () => ipcRenderer.removeListener('terminal:ghost:exit', handler);
      },
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
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    mkdir: (dirPath: string) => ipcRenderer.invoke('file:mkdir', dirPath),
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
    ask: (payload: { prompt: string; cwd: string; sessionId?: string; model?: string }) =>
      ipcRenderer.invoke('claude:ask', payload),
    clearSession: () => ipcRenderer.invoke('claude:clear-session'),
    cancel: () => ipcRenderer.invoke('claude:cancel'),
    status: () => ipcRenderer.invoke('claude:status'),
    saveApiKey: (key: string) => ipcRenderer.invoke('claude:save-api-key', key),
    getApiKey: () => ipcRenderer.invoke('claude:get-api-key'),
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
    cancelClone: () => ipcRenderer.invoke('github:cancel-clone'),
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
    getDeviceId: () => ipcRenderer.invoke('device:get-id'),
    onRevoked: (cb: (data: { reason: string; message: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: { reason: string; message: string }) => cb(d);
      ipcRenderer.on('license:revoked', handler);
      return () => ipcRenderer.removeListener('license:revoked', handler);
    },
  },

  health: {
    get: () => ipcRenderer.invoke('health:get'),
    setPreviewPort: (port: number | null) => ipcRenderer.invoke('health:set-preview-port', port),
    onUpdated: (cb: (data: import('../main/services/health').HealthStatus) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: import('../main/services/health').HealthStatus) => cb(d);
      ipcRenderer.on('health:updated', handler);
      return () => ipcRenderer.removeListener('health:updated', handler);
    },
  },

  broadcast: {
    get: () => ipcRenderer.invoke('broadcast:get'),
    dismiss: (id: string) => ipcRenderer.invoke('broadcast:dismiss', id),
    onUpdated: (cb: (data: import('../main/services/broadcast').BroadcastMessage[]) => void) => {
      const handler = (_: Electron.IpcRendererEvent, d: import('../main/services/broadcast').BroadcastMessage[]) => cb(d);
      ipcRenderer.on('broadcast:updated', handler);
      return () => ipcRenderer.removeListener('broadcast:updated', handler);
    },
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

  media: {
    requestMicrophone: () => ipcRenderer.invoke('media:request-microphone'),
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

  skills: {
    load: (projectPath?: string) => ipcRenderer.invoke('skills:load', projectPath),
    list: (projectPath?: string) => ipcRenderer.invoke('skills:list', projectPath),
    save: (projectPath: string, id: string, content: string) =>
      ipcRenderer.invoke('skills:save', projectPath, id, content),
  },

  aiProvider: {
    ask: (payload: { provider: string; model: string; prompt: string; systemPrompt?: string; history?: Array<{ role: string; content: string }> }) =>
      ipcRenderer.invoke('aiProvider:ask', payload),
    cancel: () => ipcRenderer.invoke('aiProvider:cancel'),
    transcribe: (audioBuffer: ArrayBuffer, lang?: string) =>
      ipcRenderer.invoke('aiProvider:transcribe', Buffer.from(audioBuffer), lang),
    saveKey: (provider: string, key: string) => ipcRenderer.invoke('aiProvider:save-key', provider, key),
    getKey: (provider: string) => ipcRenderer.invoke('aiProvider:get-key', provider),
    models: () => ipcRenderer.invoke('aiProvider:models'),
    onChunk: (cb: (data: { text: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { text: string }) => cb(data);
      ipcRenderer.on('aiProvider:chunk', handler);
      return () => ipcRenderer.removeListener('aiProvider:chunk', handler);
    },
    onError: (cb: (data: { message: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { message: string }) => cb(data);
      ipcRenderer.on('aiProvider:error', handler);
      return () => ipcRenderer.removeListener('aiProvider:error', handler);
    },
  },
});
