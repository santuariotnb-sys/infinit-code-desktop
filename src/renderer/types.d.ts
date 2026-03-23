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
    onInstallProgress: (cb: (data: { pct: number; msg: string }) => void) => () => void;
    onAuthenticated: (cb: () => void) => () => void;
  };
  github: {
    checkInstalled: () => Promise<{ installed: boolean; version?: string }>;
    clone: (url: string, dest: string) => Promise<{ success: boolean; error?: string }>;
    getStatus: (cwd: string) => Promise<{ isRepo: boolean; branch: string; changes: { status: string; file: string }[] }>;
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
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
