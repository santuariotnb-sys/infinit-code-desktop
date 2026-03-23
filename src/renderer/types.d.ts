interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface ElectronAPI {
  terminal: {
    create: (cwd?: string) => Promise<{ cols: number; rows: number }>;
    write: (data: string) => Promise<void>;
    resize: (cols: number, rows: number) => Promise<void>;
    kill: () => Promise<void>;
    onData: (cb: (data: string) => void) => () => void;
    onInject?: (cb: (text: string) => void) => () => void;
  };
  files: {
    read: (filePath: string) => Promise<string>;
    write: (filePath: string, content: string) => Promise<void>;
    readDir: (dirPath: string) => Promise<FileNode[]>;
    openDialog: () => Promise<string | null>;
    getHome: () => Promise<string>;
    watch: (dirPath: string) => Promise<void>;
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
  };
  github: {
    checkInstalled: () => Promise<{ installed: boolean; version?: string }>;
    connectOAuth: () => Promise<{ connected: boolean; username?: string; avatar_url?: string; error?: string }>;
    authStatus: () => Promise<{ connected: boolean; username?: string; avatar?: string }>;
    disconnect: () => Promise<{ ok: boolean }>;
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
    onProgress: (cb: (data: { step: string; pct: number; msg: string }) => void) => () => void;
    onComplete: (cb: () => void) => () => void;
    onNeedNode: (cb: () => void) => () => void;
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
