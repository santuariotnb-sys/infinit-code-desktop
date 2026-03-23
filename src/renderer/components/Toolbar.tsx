import React from 'react';

interface ToolbarProps {
  projectPath: string;
  fileName: string;
  modified: boolean;
  onSave: () => void;
  onOpenFolder: () => void;
  onTogglePreview: () => void;
  onToggleChat: () => void;
  showPreview: boolean;
  showChat: boolean;
}

export default function Toolbar({
  projectPath,
  fileName,
  modified,
  onSave,
  onOpenFolder,
  onTogglePreview,
  onToggleChat,
  showPreview,
  showChat,
}: ToolbarProps) {
  const projectName = projectPath.split('/').pop() || projectPath;

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <span style={styles.logo}>∞</span>
        <span style={styles.projectName}>{projectName}</span>
        {fileName && (
          <>
            <span style={styles.separator}>/</span>
            <span style={styles.fileName}>
              {fileName}
              {modified && <span style={styles.dot}>●</span>}
            </span>
          </>
        )}
      </div>

      <div style={styles.right}>
        {modified && (
          <button style={styles.saveBtn} onClick={onSave} title="Salvar (Cmd+S)">
            Salvar
          </button>
        )}

        <button style={styles.iconBtn} onClick={onOpenFolder} title="Abrir pasta">
          📁
        </button>

        <button
          style={{
            ...styles.iconBtn,
            background: showPreview ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
          }}
          onClick={onTogglePreview}
          title="Preview"
        >
          👁
        </button>

        <button
          style={{
            ...styles.iconBtn,
            background: showChat ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
          }}
          onClick={onToggleChat}
          title="IntelliChat"
        >
          💬
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '40px',
    padding: '0 16px',
    background: '#111',
    borderBottom: '1px solid #2a2a2a',
    // @ts-expect-error electron CSS property
WebkitAppRegion: 'drag',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    // @ts-expect-error electron CSS property
WebkitAppRegion: 'no-drag',
  },
  logo: {
    color: '#00ff88',
    fontSize: '18px',
    fontWeight: 300,
  },
  projectName: {
    color: '#888',
    fontSize: '13px',
    fontWeight: 500,
  },
  separator: {
    color: '#333',
    fontSize: '13px',
  },
  fileName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dot: {
    color: '#ffaa00',
    fontSize: '10px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    // @ts-expect-error electron CSS property
WebkitAppRegion: 'no-drag',
  },
  saveBtn: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: '8px',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};
