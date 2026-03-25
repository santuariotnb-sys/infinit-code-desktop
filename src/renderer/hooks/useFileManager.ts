import { useState, useCallback, useEffect } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export function useFileManager() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  const loadFiles = useCallback(async (dir: string) => {
    const result = await window.api.files.readDir(dir);
    if (result?.ok) {
      setFiles(result.data);
    } else {
      console.error('[useFileManager] readDir falhou:', result?.error);
      setFiles([]);
    }
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
    openProject,
    handleOpenFolder,
    handleSelectFile,
    handleSave,
    handleContentChange,
    closeTab,
  };
}
