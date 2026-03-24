interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface ElectronAPI {
  terminal: {
    create: (cwd?: string) => Promise<{ ok: boolean; cols?: number; rows?: number; error?: string }>;
    write: (data: string) => Promise<void>;
    resize: (cols: number, rows: number) => Promise<void>;
    kill: () => Promise<void>;
    onData: (cb: (data: string) => void) => () => void;
    onInject?: (cb: (text: string) => void) => () => void;
  };
  files: {
    read: (filePath: string) => Promise<{ ok: boolean; data?: string; error?: string }>;
    write: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
    readDir: (dirPath: string) => Promise<{ ok: boolean; data?: FileNode[]; error?: string }>;
    openDialog: () => Promise<string | null>;
    getHome: () => Promise<string>;
    watch: (dirPath: string) => Promise<void>;
    unwatch: () => Promise<void>;
    onChanged: (cb: (filePath: string) => void) => () => void;
  };
  claude: {
    checkInstalled: () => Promise<{ installed: boolean; version?: string }>;
    install: () => Promise<{ success: boolean; error?: string }>;
    checkAuth: () => Promise<{ authenticated: boolean; email?: string }>;
    openAuth: () => Promise<void>;
    installSkills: () => Promise<{ installed: string[] }>;
    voiceStatus: () => Promise<{ supported: boolean; version: string }>;
    voiceStart: () => Promise<{ ok: boolean }>;
    writeVoiceSettings: () => Promise<{ ok: boolean }>;
    onInstallProgress: (cb: (data: { pct: number; msg: string }) => void) => () => void;
    onAuthenticated: (cb: () => void) => () => void;
    status?: () => Promise<{ installed: boolean; version: string | null }>;
    ask?: (payload: { prompt: string; cwd: string; sessionId?: string }) =>
      Promise<{ ok: boolean; sessionId: string | null; cost_usd: number; chunks: object[] }>;
    clearSession?: () => Promise<{ ok: boolean }>;
    onChunk?: (cb: (data: { text: string }) => void) => () => void;
    onTool?: (cb: (data: { name: string; input: unknown }) => void) => () => void;
    onError?: (cb: (data: { message: string }) => void) => () => void;
  };
  github: {
    checkInstalled: () => Promise<{ installed: boolean; version?: string }>;
    connectOAuth?: () => Promise<{ connected: boolean; username?: string; avatar_url?: string; error?: string }>;
    deviceFlowStart?: () => Promise<{ ok?: boolean; userCode: string; verificationUri: string; deviceCode: string; interval: number; error?: string }>;
    deviceFlowPoll?: (deviceCode: string, interval: number) => Promise<{ connected: boolean; user?: string; avatar?: string; error?: string; pending?: boolean }>;
    savePat?: (token: string) => Promise<{ ok: boolean; user?: string; avatar?: string; error?: string }>;
    authStatus: () => Promise<{ connected: boolean; user?: string; avatar?: string }>;
    commit?: (cwd: string, message: string) => Promise<{ ok: boolean; error?: string }>;
    disconnect: () => Promise<{ ok: boolean }>;
    onDeviceFlowProgress?: (cb: () => void) => () => void;
    clone: (repo: string, dest: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
    listRepos: () => Promise<{ repos: RepoInfo[]; error?: string }>;
    gitStatus: (cwd: string) => Promise<{ isRepo: boolean; branch: string; changes: GitChange[] }>;
    sync: (cwd: string, branch: string) => Promise<{ pushed: boolean; conflicts: boolean; log: string }>;
    pull: (cwd: string, branch: string) => Promise<{ ok: boolean }>;
    push: (cwd: string, branch: string) => Promise<{ ok: boolean }>;
    branches: (cwd: string) => Promise<{ branches: string[] }>;
    createBranch: (cwd: string, name: string) => Promise<{ ok: boolean; error?: string }>;
    watchForChanges: (projectPath: string) => Promise<{ ok: boolean }>;
    onSyncProgress: (cb: (data: { step?: string; msg?: string }) => void) => () => void;
    onLocalChanges: (cb: (files: string[]) => void) => () => void;
  };
  license: {
    validate: (key: string, email: string) => Promise<{ valid: boolean; plan?: string; expiresAt?: string; error?: string }>;
    getStored: () => Promise<{ valid: boolean; key: string; email: string; plan: string } | null>;
    clear: () => Promise<void>;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
    onUpdateAvailable: (cb: (version: string) => void) => () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  setup: {
    onProgress: (cb: (data: { step: string; pct: number; msg: string; status: 'active' | 'done' | 'error' }) => void) => () => void;
    onComplete: (cb: () => void) => () => void;
    onNeedNode: (cb: () => void) => () => void;
    onNeedGit?: (cb: () => void) => () => void;
    onNeedClaude?: (cb: () => void) => () => void;
  };
  auth: {
    loginGithub: () => Promise<{ ok: boolean; email?: string; name?: string; avatar?: string; provider?: string; error?: string }>;
    loginGithubPat: (token: string) => Promise<{ ok: boolean; email?: string; name?: string; avatar?: string; error?: string }>;
    loginGoogle: () => Promise<{ ok: boolean; email?: string; name?: string; avatar?: string; provider?: string; error?: string }>;
    getSession: () => Promise<{ email: string; name: string; avatar: string; provider: 'google' | 'github' } | null>;
    logout: () => Promise<boolean>;
  };
  screenshot: () => Promise<string>;
}

interface GitChange {
  status: string;
  file: string;
}

interface RepoInfo {
  name: unknown;
  fullName: unknown;
  private: unknown;
  defaultBranch: unknown;
  updatedAt: unknown;
  description: unknown;
  language: unknown;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
