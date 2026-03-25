import React, { useState, useEffect } from 'react';
import { useGitStatus } from '../hooks/useGitStatus';
import { useGitOperations } from '../hooks/useGitOperations';

interface GitPanelProps {
  projectPath: string | null;
  onSyncProgress?: (msg: string) => void;
  onSyncDone?: () => void;
  open: boolean;
  onClose: () => void;
  onConnect?: () => void;
  onChangesUpdate?: (count: number) => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: '#f0a020' },
  A: { label: 'A', color: '#3CB043' },
  D: { label: 'D', color: '#d93030' },
  '?': { label: '?', color: '#888' },
  R: { label: 'R', color: '#6080d0' },
  C: { label: 'C', color: '#6080d0' },
  U: { label: 'U', color: '#d93030' },
};

export default function GitPanel({ projectPath, onSyncProgress, onSyncDone, open, onClose, onConnect, onChangesUpdate }: GitPanelProps) {
  const [commitMsg, setCommitMsg] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showBranchInput, setShowBranchInput] = useState(false);
  const [branchError, setBranchError] = useState('');

  const { branch, setBranch, branches, changes, localChangeCount, refreshStatus } = useGitStatus(projectPath);
  const ops = useGitOperations({ projectPath, branch, onProgress: onSyncProgress, onRefresh: refreshStatus, onSyncDone });

  useEffect(() => { onChangesUpdate?.(changes.length); }, [changes.length, onChangesUpdate]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        right: 0,
        bottom: 22,
        width: 348,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(218,221,228,0.95)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderLeft: '1px solid rgba(255,255,255,0.55)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(.22,1,.36,1)',
        pointerEvents: open ? 'all' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={styles.header}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="#72757f">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <span style={styles.headerTitle}>
          GitHub
          {ops.connected && ops.username && (
            <span style={styles.username}> · {ops.username}</span>
          )}
        </span>
        <button style={styles.closeBtn} onClick={onClose} title="Fechar">✕</button>
      </div>

      {/* Branch info */}
      {ops.connected && (
        <div style={styles.branchRow}>
          <span style={styles.branchIcon}>⑂</span>
          <select
            style={styles.branchSelect}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <button
            style={styles.smallBtn}
            onClick={() => setShowBranchInput(!showBranchInput)}
            title="Nova branch"
          >+</button>
        </div>
      )}

      {showBranchInput && (
        <div style={{ ...styles.branchRow, padding: '4px 12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <input
              style={{ ...styles.branchInput, borderColor: branchError ? 'rgba(217,48,48,0.4)' : 'rgba(255,255,255,0.5)' }}
              value={newBranchName}
              onChange={(e) => { setNewBranchName(e.target.value); setBranchError(''); }}
              placeholder="nome-da-branch"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = newBranchName.trim().replace(/\s+/g, '-');
                  if (!name) { setBranchError('Nome obrigatório'); return; }
                  if (/[~^:?*\[\\]/.test(name)) { setBranchError('Caracteres inválidos'); return; }
                  ops.handleCreateBranch(name, () => { setNewBranchName(''); setShowBranchInput(false); setBranchError(''); });
                }
              }}
            />
            {branchError && <span style={{ fontSize: 10, color: '#d93030', fontFamily: 'monospace' }}>{branchError}</span>}
          </div>
          <button
            style={styles.smallBtn}
            onClick={() => {
              const name = newBranchName.trim().replace(/\s+/g, '-');
              if (!name) { setBranchError('Nome obrigatório'); return; }
              if (/[~^:?*\[\\]/.test(name)) { setBranchError('Caracteres inválidos'); return; }
              ops.handleCreateBranch(name, () => { setNewBranchName(''); setShowBranchInput(false); setBranchError(''); });
            }}
          >✓</button>
        </div>
      )}

      <div style={styles.body}>
        {!ops.connected ? (
          <div style={styles.connectArea}>
            <button style={styles.connectBtn} onClick={onConnect} disabled={ops.loading}>
              {ops.loading ? 'Conectando...' : 'Conectar com GitHub →'}
            </button>
            <p style={styles.connectHint}>Necessário para sync com Lovable</p>
          </div>
        ) : (
          <>
            {/* Sync status */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Sincronização</div>
              <div style={styles.syncRow}>
                {changes.length > 0 && (
                  <span style={styles.aheadBadge}>↑ {changes.length} ahead</span>
                )}
                {localChangeCount > 0 && (
                  <span style={styles.localBadge}>+{localChangeCount} salvas</span>
                )}
                <span style={{ flex: 1 }} />
                <button style={styles.syncActionBtn} onClick={ops.handlePush} disabled={ops.loading}>Push</button>
                <button style={styles.syncActionBtn} onClick={ops.handlePull} disabled={ops.loading}>Pull</button>
              </div>
            </div>

            {/* Alterações */}
            {changes.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Alterações ({changes.length})</div>
                <div style={styles.fileList}>
                  {changes.map((c, i) => {
                    const badge = STATUS_BADGE[c.status] || { label: c.status, color: '#888' };
                    return (
                      <div key={i} style={styles.fileItem}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: `${badge.color}22`,
                            color: badge.color,
                            borderColor: `${badge.color}44`,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={styles.fileName}>{c.file}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Commit */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Commit</div>
              <input
                style={styles.commitInput}
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="feat: descrição das mudanças"
                onKeyDown={(e) => e.key === 'Enter' && ops.handleCommit(commitMsg, () => setCommitMsg(''))}
              />
              <div style={styles.commitBtns}>
                <button
                  style={{ ...styles.commitBtn, opacity: commitMsg.trim() ? 1 : 0.4 }}
                  onClick={() => ops.handleCommit(commitMsg, () => setCommitMsg(''))}
                  disabled={!commitMsg.trim() || ops.loading}
                >
                  Commit
                </button>
                <button
                  style={{ ...styles.commitPushBtn, opacity: commitMsg.trim() ? 1 : 0.4 }}
                  onClick={async () => {
                    const ok = await ops.handleCommit(commitMsg, () => setCommitMsg(''));
                    if (ok) await ops.handlePush();
                  }}
                  disabled={!commitMsg.trim() || ops.loading}
                >
                  Commit & Push
                </button>
              </div>
            </div>

            {/* Log recente */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Log recente</div>
              <button style={styles.lovableBtn} onClick={ops.handleSyncWithLovable} disabled={ops.loading}>
                Sync com Lovable →
              </button>
            </div>

            {ops.syncLog.trim() && (
              <pre style={styles.syncLog}>{ops.syncLog.trim()}</pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 14px',
    borderBottom: '1px solid rgba(255,255,255,0.55)',
    background: 'rgba(213,216,222,0.9)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 13,
    color: '#3a3d45',
    fontWeight: 500,
    flex: 1,
  },
  username: {
    color: '#72757f',
    fontWeight: 400,
    fontSize: 12,
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.5)',
    border: 'none',
    borderRadius: 5,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#a8aab4',
    fontSize: 12,
    boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset',
  },
  branchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.4)',
    background: 'rgba(213,216,222,0.5)',
    flexShrink: 0,
  },
  branchIcon: { color: '#72757f', fontSize: 14 },
  branchSelect: {
    flex: 1,
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#3a3d45',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    outline: 'none',
  },
  branchInput: {
    flex: 1,
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#3a3d45',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    outline: 'none',
  },
  smallBtn: {
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#72757f',
    cursor: 'pointer',
    borderRadius: 6,
    padding: '4px 9px',
    fontSize: 13,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  connectArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    paddingTop: 24,
  },
  connectBtn: {
    background: 'rgba(60,176,67,0.1)',
    border: '1px solid rgba(60,176,67,0.3)',
    color: '#3CB043',
    padding: '9px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    width: '100%',
  },
  connectHint: {
    color: '#a8aab4',
    fontSize: 11,
    textAlign: 'center',
    margin: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 9.5,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#a8aab4',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 2,
  },
  syncRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  aheadBadge: {
    background: 'rgba(60,176,67,0.12)',
    border: '1px solid rgba(60,176,67,0.25)',
    color: '#3CB043',
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  localBadge: {
    background: 'rgba(160,160,160,0.12)',
    border: '1px solid rgba(160,160,160,0.2)',
    color: '#888',
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  },
  syncActionBtn: {
    background: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#3a3d45',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 11.5,
    fontWeight: 500,
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
  },
  fileList: {
    background: 'rgba(255,255,255,0.45)',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.5)',
    overflow: 'hidden',
    maxHeight: 240,
    overflowY: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.3)',
  },
  statusBadge: {
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 3,
    border: '1px solid',
    flexShrink: 0,
    minWidth: 18,
    textAlign: 'center',
  } as React.CSSProperties,
  fileName: {
    color: '#5a5d66',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  moreFiles: {
    color: '#a8aab4',
    fontSize: 10,
    padding: '4px 10px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  commitInput: {
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#3a3d45',
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  commitBtns: {
    display: 'flex',
    gap: 6,
  },
  commitBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: '#3a3d45',
    borderRadius: 7,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
  },
  commitPushBtn: {
    flex: 1,
    background: 'rgba(60,176,67,0.15)',
    border: '1px solid rgba(60,176,67,0.3)',
    color: '#3CB043',
    borderRadius: 7,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  lovableBtn: {
    background: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(255,255,255,0.45)',
    color: '#5a5d66',
    borderRadius: 7,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 12,
    width: '100%',
    textAlign: 'left',
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
  } as React.CSSProperties,
  syncLog: {
    background: 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: 7,
    padding: '8px 10px',
    fontSize: 10,
    color: '#72757f',
    fontFamily: "'JetBrains Mono', monospace",
    overflow: 'auto',
    maxHeight: 80,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
  } as React.CSSProperties,
};
