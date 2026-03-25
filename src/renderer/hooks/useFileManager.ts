import { useState, useCallback, useEffect } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

type PkgManager = 'npm' | 'bun' | 'pnpm' | 'yarn';

function detectPkgManager(fileNames: string[]): PkgManager {
  if (fileNames.includes('bun.lock') || fileNames.includes('bun.lockb')) return 'bun';
  if (fileNames.includes('pnpm-lock.yaml')) return 'pnpm';
  if (fileNames.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

export function useFileManager() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [pkgManager, setPkgManager] = useState<PkgManager>('npm');
  const [hasNodeModules, setHasNodeModules] = useState<boolean | null>(null); // null = ainda verificando

  const loadFiles = useCallback(async (dir: string) => {
    const result = await window.api.files.readDir(dir);
    if (result?.ok) {
      setFiles(result.data ?? []);
      // Detecta package manager pelos arquivos de lock na raiz
      const rootNames = (result.data ?? []).map((f: FileNode) => f.name);
      setPkgManager(detectPkgManager(rootNames));
    } else {
      setFiles([]);
    }
    // Verifica se node_modules existe
    const nmCheck = await window.api.files.exists(`${dir}/node_modules`);
    setHasNodeModules(nmCheck?.exists ?? false);
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    loadFiles(projectPath);
    // Terminal já é criado pelo componente Terminal.tsx no mount.
    // Apenas muda o cwd do PTY existente via cd, sem matar o processo.
    window.api.terminal.write(`cd "${projectPath}"\r`);
    window.api.files.watch(projectPath);
    const cleanupListener = window.api.files.onChanged(() => loadFiles(projectPath));
    return () => {
      cleanupListener();
      window.api.files.unwatch();
    };
  }, [projectPath, loadFiles]);

  async function openProject(path: string) {
    setProjectPath(path);
    setOpenFile(null);
    setFileContent('');
    setIsModified(false);
    setOpenTabs([]);
    setHasNodeModules(null); // reset enquanto recarrega
  }

  async function handleOpenFolder() {
    const path = await window.api.files.openDialog();
    if (path) await openProject(path);
  }

  async function handleSelectFile(filePath: string) {
    if (isModified && openFile) await handleSave();
    const result = await window.api.files.read(filePath);
    if (result?.ok) {
      setOpenFile(filePath);
      setFileContent(result.data);
      setIsModified(false);
      setOpenTabs((prev) => prev.includes(filePath) ? prev : [...prev, filePath]);
    } else {
      console.error('[useFileManager] read falhou:', result?.error);
    }
  }

  async function closeTab(filePath: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== filePath);
      if (openFile === filePath) {
        const idx = prev.indexOf(filePath);
        const newActive = next[Math.max(0, idx - 1)] ?? next[0] ?? null;
        if (newActive) {
          handleSelectFile(newActive);
        } else {
          setOpenFile(null);
          setFileContent('');
          setIsModified(false);
        }
      }
      return next;
    });
  }

  async function handleSave() {
    if (openFile && isModified) {
      const result = await window.api.files.write(openFile, fileContent);
      if (result?.ok) {
        setIsModified(false);
      } else {
        console.error('[useFileManager] write falhou:', result?.error);
      }
    }
  }

  function handleContentChange(value: string | undefined) {
    if (value !== undefined) {
      setFileContent(value);
      setIsModified(true);
    }
  }

  return {
    projectPath,
    files,
    openFile,
    fileContent,
    isModified,
    openTabs,
    pkgManager,
    hasNodeModules,
    openProject,
    handleOpenFolder,
    handleSelectFile,
    handleSave,
    handleContentChange,
    closeTab,
  };
}
