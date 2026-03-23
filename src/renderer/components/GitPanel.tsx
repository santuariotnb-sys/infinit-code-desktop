import React, { useState, useEffect, useCallback } from 'react';

interface GitChange {
  status: string;
  file: string;
}

interface GitPanelProps {
  projectPath: string | null;
  onSyncProgress?: (msg: string) => void;
}

const STATUS_ICON: Record<string, string> = {
  M: '●', A: '+', D: '−', '?': '?', R: '→', C: '⇒', U: '!',
};

export default function GitPanel({ projectPath, onSyncProgress }: GitPanelProps) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [localChangeCount, setLocalChangeCount] = useState(0);
  const [newBranchName, setNewBranchName] = useState('');
  const [showBranchInput, setShowBranchInput] = useState(false);

  // Check auth on mount
  useEffect(() => {
    window.api.github.authStatus().then((s) => {
      setConnected(s.connected);
      if (s.username) setUsername(s.username);
    });
  }, []);

  // Load git status when project changes
  const refreshStatus = useCallback(async () => {
    if (!projectPath) return;
    const s = await window.api.github.gitStatus(projectPath);
    if (s.isRepo) {
      setBranch(s.branch);
      setChanges(s.changes);
    }
    const b = await window.api.github.branches(projectPath);
    setBranches(b.branches || []);
  }, [projectPath]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Listen for local file changes
  useEffect(() => {
    if (!projectPath) return;
    window.api.github.watchForChanges(projectPath);
    const cleanup = window.api.github.onLocalChanges((files: string[]) => {
      setLocalChangeCount(files.length);
      refreshStatus();
    });
    return cleanup;
  }, [projectPath, refreshStatus]);

  // Listen for sync progress
  useEffect(() => {
    const cleanup = window.api.github.onSyncProgress((data: { step?: string; msg?: string }) => {
      const txt = data.msg || data.step || '';
      if (txt) {
        setSyncLog((prev) => (prev + '\n' + txt).split('\n').slice(-20).join('\n'));
        onSyncProgress?.(txt);
      }
    });
    return cleanup;
  }, [onSyncProgress]);

  async function handleConnect() {
    setLoading(true);
    const result = await window.api.github.connectOAuth();
    setLoading(false);
    if (result.connected) {
      setConnected(true);
      setUsername(result.username || '');
    }
  }

  async function handleDisconnect() {
    await window.api.github.disconnect();
    setConnected(false);
    setUsername('');
  }

  async function handlePull() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.pull(projectPath, branch);
    await refreshStatus();
    setLoading(false);
  }

  async function handlePush() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.push(projectPath, branch);
    setLoading(false);
  }

  async function handleSync() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.sync(projectPath, branch);
    await refreshStatus();
    setLoading(false);
  }

  async function handleCommit() {
    if (!projectPath || !commitMsg.trim()) return;
    setLoading(true);
    // Use sync with just add + commit
    await window.api.github.sync(projectPath, branch);
    setCommitMsg('');
    await refreshStatus();
    setLoading(false);
  }

  async function handleCreateBranch() {
    if (!projectPath || !newBranchName.trim()) return;
    await window.api.github.createBranch(projectPath, newBranchName.trim());
    setNewBranchName('');
    setShowBranchInput(false);
    await refreshStatus();
  }

  async function handleSyncWithLovable() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.sync(projectPath, branch);
    await window.api.shell.openExternal('https://lovable.dev');
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>⑂</span>
        <span style={styles.title}>
          GitHub {connected ? <span style={styles.username}>● {username}</span> : null}
        </span>
        {connected && (
          <button style={styles.disconnectBtn} onClick={handleDisconnect} title="Desconectar">×</button>
        )}
      </div>

      {!connected ? (
        <div style={styles.connectArea}>
          <button style={styles.connectBtn} onClick={handleConnect} disabled={loading}>
            {loading ? 'Conectando...' : 'Conectar com GitHub →'}
          </button>
          <p style={styles.connectHint}>Necessário para sync com Lovable</p>
        </div>
      ) : (
        <div style={styles.body}>
          {/* Branch selector */}
          <div style={styles.row}>
            <span style={styles.label}>Branch</span>
            <select
              style={styles.branchSelect}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button style={styles.smallBtn} onClick={() => setShowBranchInput(!showBranchInput)} title="Nova branch">+</button>
          </div>

          {showBranchInput && (
            <div style={styles.row}>
              <input
                style={styles.branchInput}
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="nome-da-branch"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
              />
              <button style={styles.smallBtn} onClick={handleCreateBranch}>✓</button>
            </div>
          )}

          {/* Change count badge */}
          {changes.length > 0 && (
            <div style={styles.changeBadge}>
              {changes.length} mudança{changes.length !== 1 ? 's' : ''} local{changes.length !== 1 ? 'is' : ''}
              {localChangeCount > 0 && <span style={styles.watchBadge}> +{localChangeCount} salvas</span>}
            </div>
          )}

          {/* Quick actions */}
          <div style={styles.actions}>
            <button style={styles.actionBtn} onClick={handlePull} disabled={loading}>↓ Pull</button>
            <button style={styles.actionBtn} onClick={handlePush} disabled={loading}>↑ Push</button>
            <button style={{ ...styles.actionBtn, ...styles.syncBtn }} onClick={handleSync} disabled={loading}>
              {loading ? '⟳' : '⟳ Sync'}
            </button>
          </div>

          {/* Changed files */}
          {changes.length > 0 && (
            <div style={styles.fileList}>
              {changes.slice(0, 15).map((c, i) => (
                <div key={i} style={styles.fileItem}>
                  <span style={{ ...styles.fileStatus, color: c.status === '?' ? '#888' : c.status === 'D' ? '#ff6060' : '#00ff88' }}>
                    {STATUS_ICON[c.status] || c.status}
                  </span>
                  <span style={styles.fileName}>{c.file}</span>
                </div>
              ))}
              {changes.length > 15 && (
                <div style={styles.moreFiles}>+{changes.length - 15} mais</div>
              )}
            </div>
          )}

          {/* Commit */}
          <div style={styles.commitArea}>
            <input
              style={styles.commitInput}
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Mensagem do commit..."
              onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
            />
            <button
              style={{ ...styles.commitBtn, opacity: commitMsg.trim() ? 1 : 0.4 }}
              onClick={handleCommit}
              disabled={!commitMsg.trim() || loading}
            >
              ✓
            </button>
          </div>

          {/* Sync with Lovable */}
          <button style={styles.lovableBtn} onClick={handleSyncWithLovable} disabled={loading}>
            Sync com Lovable →
          </button>

          {/* Sync log */}
          {syncLog.trim() && (
            <pre style={styles.syncLog}>{syncLog.trim()}</pre>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#111',
    fontSize: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  icon: { color: '#888', fontSize: 14 },
  title: { color: '#ccc', fontWeight: 600, flex: 1, fontSize: 12 },
  username: { color: '#00ff88', fontSize: 11, fontWeight: 400 },
  disconnectBtn: {
    background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 2px',
  },
  connectArea: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  connectBtn: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#00ff88',
    padding: '8px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    width: '100%',
  },
  connectHint: { color: '#444', fontSize: 11, textAlign: 'center' },
  body: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6 },
  label: { color: '#555', fontSize: 11, width: 38, flexShrink: 0 },
  branchSelect: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#ccc',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 11,
  },
  branchInput: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#ccc',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 11,
    outline: 'none',
  },
  smallBtn: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888',
    cursor: 'pointer', borderRadius: 4, padding: '2px 7px', fontSize: 12,
  },
  changeBadge: {
    background: 'rgba(0,255,136,0.08)',
    border: '1px solid rgba(0,255,136,0.15)',
    color: '#00ff88',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 11,
  },
  watchBadge: { color: '#888', fontSize: 10 },
  actions: { display: 'flex', gap: 4 },
  actionBtn: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#888',
    borderRadius: 4,
    padding: '5px 0',
    cursor: 'pointer',
    fontSize: 11,
  },
  syncBtn: { color: '#00ff88', borderColor: 'rgba(0,255,136,0.2)' },
  fileList: {
    background: '#0d0d0d',
    borderRadius: 4,
    border: '1px solid #1a1a1a',
    padding: '4px 0',
    maxHeight: 120,
    overflow: 'auto',
  },
  fileItem: { display: 'flex', gap: 6, padding: '2px 8px', alignItems: 'center' },
  fileStatus: { fontWeight: 700, fontSize: 11, width: 12, flexShrink: 0, fontFamily: 'monospace' },
  fileName: { color: '#888', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  moreFiles: { color: '#444', fontSize: 10, padding: '2px 8px' },
  commitArea: { display: 'flex', gap: 4, alignItems: 'center' },
  commitInput: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#ccc',
    borderRadius: 4,
    padding: '5px 8px',
    fontSize: 11,
    outline: 'none',
  },
  commitBtn: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 4,
    padding: '5px 10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
  },
  lovableBtn: {
    background: 'rgba(0,255,136,0.05)',
    border: '1px solid rgba(0,255,136,0.2)',
    color: '#00ff88',
    borderRadius: 4,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 11,
    width: '100%',
    marginTop: 4,
  },
  syncLog: {
    background: '#0d0d0d',
    border: '1px solid #1a1a1a',
    borderRadius: 4,
    padding: '6px 8px',
    fontSize: 10,
    color: '#555',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: 80,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
  },
};
