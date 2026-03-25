import { useState, useCallback, useEffect, useRef } from 'react';
import { FILE_MANAGER } from '../lib/constants';

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

// Extensões de arquivo que Vite consegue fazer HMR
const HMR_EXTENSIONS = /\.(tsx?|jsx?|css|scss|sass|less|html|vue|svelte|json)$/i;

export function useFileManager() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [pkgManager, setPkgManager] = useState<PkgManager>('npm');
  const [hasNodeModules, setHasNodeModules] = useState<boolean | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function showError(msg: string) {
    setFileError(msg);
    setTimeout(() => setFileError(null), 4000);
  }

  // Retorna set com todos os paths de arquivo da árvore atual (busca recursiva)
  function flatFilePaths(nodes: FileNode[], out = new Set<string>()): Set<string> {
    for (const n of nodes) {
      if (n.type === 'file') out.add(n.path);
      if (n.children) flatFilePaths(n.children, out);
    }
    return out;
  }

  // Ref para debounce do auto-save (1.5s após última digitação)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para acesso ao estado atual sem closure stale
  const openFileRef = useRef<string | null>(null);
  const fileContentRef = useRef('');
  const isModifiedRef = useRef(false);
  const filesRef = useRef<FileNode[]>([]);

  openFileRef.current = openFile;
  fileContentRef.current = fileContent;
  isModifiedRef.current = isModified;
  filesRef.current = files;

  const loadFiles = useCallback(async (dir: string) => {
    const result = await window.api.files.readDir(dir);
    if (result?.ok) {
      setFiles(result.data ?? []);
      const rootNames = (result.data ?? []).map((f: FileNode) => f.name);
      setPkgManager(detectPkgManager(rootNames));
    } else {
      setFiles([]);
    }
    const nmCheck = await window.api.files.exists(`${dir}/node_modules`);
    setHasNodeModules(nmCheck?.exists ?? false);
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    loadFiles(projectPath);
    window.api.terminal.write(`cd "${projectPath}"\r`);
    window.api.files.watch(projectPath);
    // Reload condicional: se arquivo já existe na árvore, só o conteúdo mudou (HMR cuida disso)
    // Só recarrega a árvore se for um arquivo novo, deletado ou renomeado
    const cleanupListener = window.api.files.onChanged((changedPath: string) => {
      const known = flatFilePaths(filesRef.current);
      const fileExists = known.has(changedPath);
      if (!fileExists) loadFiles(projectPath);
    });
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
    setHasNodeModules(null);
  }

  async function handleOpenFolder() {
    const path = await window.api.files.openDialog();
    if (path) await openProject(path);
  }

  async function handleSelectFile(filePath: string) {
    // Salva pendente antes de trocar
    if (isModifiedRef.current && openFileRef.current) await handleSave();
    const result = await window.api.files.read(filePath);
    if (result?.ok) {
      setOpenFile(filePath);
      setFileContent(result.data);
      setIsModified(false);
      setOpenTabs((prev) => prev.includes(filePath) ? prev : [...prev, filePath]);
    } else {
      showError(`Não foi possível abrir: ${result?.error || 'erro desconhecido'}`);
    }
  }

  async function closeTab(filePath: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== filePath);
      if (openFileRef.current === filePath) {
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
    const path = openFileRef.current;
    const content = fileContentRef.current;
    if (path && isModifiedRef.current) {
      setIsSaving(true);
      try {
        const result = await window.api.files.write(path, content);
        if (result?.ok) {
          setIsModified(false);
          isModifiedRef.current = false;
        } else {
          showError(`Erro ao salvar: ${result?.error || 'erro desconhecido'}`);
        }
      } finally {
        setIsSaving(false);
      }
    }
  }

  function handleContentChange(value: string | undefined) {
    if (value === undefined) return;
    setFileContent(value);
    setIsModified(true);
    fileContentRef.current = value;
    isModifiedRef.current = true;

    // Auto-save debounced: salva 1.5s após parar de digitar
    // Isso garante que Vite sempre vê as mudanças → HMR ao vivo
    if (HMR_EXTENSIONS.test(openFileRef.current ?? '')) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => handleSave(), FILE_MANAGER.AUTOSAVE_DEBOUNCE_MS);
    }
  }

  // Cleanup do timer ao desmontar
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  return {
    projectPath,
    files,
    openFile,
    fileContent,
    isModified,
    isSaving,
    openTabs,
    pkgManager,
    hasNodeModules,
    fileError,
    openProject,
    handleOpenFolder,
    handleSelectFile,
    handleSave,
    handleContentChange,
    closeTab,
  };
}
