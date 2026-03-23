import React, { useState } from 'react';

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
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '⬡', tsx: '⬡', js: '◇', jsx: '◇',
    json: '{ }', css: '#', scss: '#', html: '<>',
    md: '¶', py: '◈', rs: '⚙', go: '◉',
    sql: '◫', yaml: '≡', yml: '≡',
    png: '◻', jpg: '◻', svg: '◻', gif: '◻',
    lock: '🔒',
  };
  return icons[ext] || '◦';
}

function TreeNode({
  node,
  depth,
  selectedFile,
  onSelectFile,
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
          style={{
            ...styles.item,
            paddingLeft: `${12 + depth * 16}px`,
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <span style={styles.folderIcon}>{expanded ? '▾' : '▸'}</span>
          <span style={styles.folderName}>{node.name}</span>
        </div>
        {expanded &&
          node.children?.map((child) => (
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
        paddingLeft: `${28 + depth * 16}px`,
        background: isSelected ? 'rgba(0, 255, 136, 0.08)' : 'transparent',
        color: isSelected ? '#00ff88' : '#ccc',
      }}
      onClick={() => onSelectFile(node.path)}
    >
      <span style={styles.fileIcon}>{getFileIcon(node.name)}</span>
      <span style={styles.fileName}>{node.name}</span>
    </div>
  );
}

export default function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText}>EXPLORER</span>
      </div>
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
    padding: '12px 16px 8px',
    borderBottom: '1px solid #2a2a2a',
  },
  headerText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#666',
    letterSpacing: '1px',
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    paddingTop: '4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  folderIcon: {
    color: '#666',
    fontSize: '10px',
    width: '12px',
    textAlign: 'center' as const,
  },
  folderName: {
    color: '#ddd',
    fontWeight: 500,
  },
  fileIcon: {
    fontSize: '10px',
    color: '#666',
    width: '16px',
    textAlign: 'center' as const,
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  empty: {
    color: '#555',
    fontSize: '12px',
    padding: '16px',
    textAlign: 'center' as const,
  },
};
