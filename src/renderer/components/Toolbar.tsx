import React from 'react';
import VoiceButton from './VoiceButton';

interface ToolbarProps {
  projectPath: string;
  fileName: string;
  modified: boolean;
  onSave: () => void;
  onOpenFolder: () => void;
  onTogglePreview: () => void;
  onToggleChat: () => void;
  onToggleGit: () => void;
  showPreview: boolean;
  showChat: boolean;
  showGit: boolean;
  gitChangeCount: number;
  livePort: number | null;
}

export default function Toolbar({
  projectPath, fileName, modified, onSave, onOpenFolder,
  onTogglePreview, onToggleChat, onToggleGit,
  showPreview, showChat, showGit, gitChangeCount, livePort,
}: ToolbarProps) {
  const projectName = projectPath.split('/').pop() || projectPath;

  return (
    <div style={styles.bar}>
      {/* Left */}
      <div style={styles.left}>
        <span style={styles.logo}>∞</span>
        <span style={styles.project}>{projectName}</span>
        {fileName && (
          <>
            <span style={styles.sep}>/</span>
            <span style={styles.file}>
              {fileName}
              {modified && <span style={styles.dot}>●</span>}
            </span>
          </>
        )}
      </div>

      {/* Center — live badge */}
      {livePort && (
        <div style={styles.liveBadge}>
          <span style={styles.liveDot} />
          <span style={styles.liveText}>LIVE</span>
          <span style={styles.livePort}>:{livePort}</span>
        </div>
      )}

      {/* Right */}
      <div style={styles.right}>
        {modified && (
          <button style={styles.saveBtn} onClick={onSave} title="Salvar (Cmd+S)">Salvar</button>
        )}

        <button style={styles.iconBtn} onClick={onOpenFolder} title="Abrir pasta">📁</button>

        <button
          style={{ ...styles.iconBtn, ...(showPreview ? styles.active : {}) }}
          onClick={onTogglePreview}
          title="Preview"
        >
          👁
        </button>

        {/* Git button with badge */}
        <button
          style={{ ...styles.iconBtn, ...(showGit ? styles.active : {}), position: 'relative' }}
          onClick={onToggleGit}
          title="Git Panel"
        >
          ⑂
          {gitChangeCount > 0 && (
            <span style={styles.badge}>{gitChangeCount}</span>
          )}
        </button>

        <button
          style={{ ...styles.iconBtn, ...(showChat ? styles.active : {}) }}
          onClick={onToggleChat}
          title="IntelliChat (Cmd+J)"
        >
          ∞
        </button>

        <VoiceButton />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 14px',
    background: '#111',
    borderBottom: '1px solid #1e1e1e',
    flexShrink: 0,
    gap: 8,
    // @ts-expect-error electron drag
    WebkitAppRegion: 'drag',
  },
  left: {
    display: 'flex', alignItems: 'center', gap: 6, flex: 1,
    // @ts-expect-error electron drag
    WebkitAppRegion: 'no-drag',
  },
  logo: { color: '#00ff88', fontSize: 18, fontWeight: 300 },
  project: { color: '#666', fontSize: 12, fontWeight: 500 },
  sep: { color: '#2a2a2a', fontSize: 12 },
  file: { color: '#ddd', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 },
  dot: { color: '#ffaa00', fontSize: 10 },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)',
    borderRadius: 4, padding: '2px 8px', flexShrink: 0,
    // @ts-expect-error electron drag
    WebkitAppRegion: 'no-drag',
  },
  liveDot: { width: 5, height: 5, borderRadius: '50%', background: '#00ff88', animation: 'pulse 2s infinite' },
  liveText: { color: '#00ff88', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' },
  livePort: { color: '#555', fontSize: 10, fontFamily: 'monospace' },
  right: {
    display: 'flex', alignItems: 'center', gap: 2,
    // @ts-expect-error electron drag
    WebkitAppRegion: 'no-drag',
  },
  saveBtn: { background: '#00ff88', color: '#0a0a0a', border: 'none', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', marginRight: 6 },
  iconBtn: { background: 'transparent', border: 'none', color: '#666', fontSize: 14, padding: '5px 7px', borderRadius: 4, cursor: 'pointer' },
  active: { background: 'rgba(0,255,136,0.12)', color: '#00ff88' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    background: '#00ff88', color: '#0a0a0a',
    borderRadius: '50%', fontSize: 8, fontWeight: 700,
    width: 12, height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
