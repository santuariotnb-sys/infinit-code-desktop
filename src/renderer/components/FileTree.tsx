import React, { useState, useRef, useEffect } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  projectPath?: string | null;
  onCreated?: () => void;
}

function FolderIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
      <path d="M.5 2A1.5 1.5 0 0 1 2 .5h2.5L6 2H10A1.5 1.5 0 0 1 11.5 3.5v5A1.5 1.5 0 0 1 10 10H2A1.5 1.5 0 0 1 .5 8.5V2Z" stroke="currentColor" strokeWidth=".9" fill="none" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
      <path d="M1 1h4l2 2v6H1z" stroke="currentColor" strokeWidth=".85" fill="none" />
    </svg>
  );
}

function TreeNode({
  node, depth, selectedFile, onSelectFile,
}: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'folder') {
    return (
      <div>
        <div
          style={{ ...styles.item, paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span style={styles.chevron}>{expanded ? '▾' : '▸'}</span>
          <FolderIcon />
          <span style={styles.folderName}>{node.name}</span>
        </div>
        {expanded && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  const isSelected = node.path === selectedFile;

  return (
    <div
      style={{
        ...styles.item,
        paddingLeft: `${24 + depth * 16}px`,
        background: isSelected ? 'rgba(255,255,255,0.5)' : 'transparent',
        color: isSelected ? '#1a1c20' : '#72757f',
        boxShadow: isSelected ? 'inset 2px 0 0 rgba(255,255,255,0.7)' : 'none',
      }}
      onClick={() => onSelectFile(node.path)}
    >
      <FileIcon />
      <span style={styles.fileName}>{node.name}</span>
    </div>
  );
}

export default function FileTree({ files, selectedFile, onSelectFile, projectPath, onCreated }: FileTreeProps) {
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) {
      setNewName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [creating]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !projectPath) { setCreating(null); return; }

    const targetPath = `${projectPath}/${name}`;
    if (creating === 'folder') {
      await window.api.files.mkdir(targetPath);
    } else {
      await window.api.files.write(targetPath, '');
    }
    setCreating(null);
    onCreated?.();
    if (creating === 'file') onSelectFile(targetPath);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') setCreating(null);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText}>Explorador</span>
        <div style={styles.actions}>
          <button
            style={styles.action}
            title="Novo arquivo"
            onClick={() => setCreating('file')}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
          <button
            style={styles.action}
            title="Nova pasta"
            onClick={() => setCreating('folder')}
          >
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M.5 2C.5 1.2 1.2.5 2 .5h2.5L6 2H10c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5H2C1.2 9.5.5 8.8.5 8V2z" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
          </button>
        </div>
      </div>

      {/* Input inline de criação */}
      {creating && (
        <div style={styles.createRow}>
          {creating === 'folder' ? <FolderIcon /> : <FileIcon />}
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setCreating(null)}
            placeholder={creating === 'folder' ? 'nova-pasta' : 'arquivo.ts'}
            style={styles.createInput}
          />
        </div>
      )}

      <div style={styles.tree}>
        {files.map((file) => (
          <TreeNode
            key={file.path}
            node={file}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        ))}
        {files.length === 0 && (
          <p style={styles.empty}>Pasta vazia</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    padding: '0 14px',
    borderBottom: '1px solid rgba(255,255,255,0.4)',
    flexShrink: 0,
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    color: '#a8aab4',
    fontFamily: "'JetBrains Mono', monospace",
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  action: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#c8cad4',
  },
  createRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  createInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 12,
    color: '#1a1c20',
    fontFamily: "'JetBrains Mono', monospace",
  },
  tree: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '6px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '4px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'all .12s',
    color: '#72757f',
  },
  chevron: {
    color: '#a8aab4',
    fontSize: 10,
    width: 10,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  folderName: {
    color: '#3a3d45',
    fontWeight: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  empty: {
    color: '#a8aab4',
    fontSize: 12,
    padding: 16,
    textAlign: 'center' as const,
    fontFamily: "'JetBrains Mono', monospace",
  },
};
