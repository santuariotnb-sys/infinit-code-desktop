import React, { useState, useEffect, useCallback, useRef } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface GitRepo {
  name: unknown;
  fullName: unknown;
}

import FileTree from '../components/FileTree';
import Editor from '../components/Editor';
import Terminal from '../components/Terminal';
import Preview from '../components/Preview';
import IntelliChat from '../components/IntelliChat';
import Toolbar from '../components/Toolbar';
import GitPanel from '../components/GitPanel';

export default function IDE() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [modified, setModified] = useState(false);

  // Panel visibility
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showGit, setShowGit] = useState(false);
  const [terminalExpanded, setTerminalExpanded] = useState(true);

  // Terminal output buffer (for Preview and IntelliChat)
  const [terminalOutput, setTerminalOutput] = useState('');
  const terminalOutputRef = useRef('');

  // Git change count for badge
  const [gitChangeCount, setGitChangeCount] = useState(0);

  // Welcome screen GitHub state
  const [ghStatus, setGhStatus] = useState<{ connected: boolean; user?: string } | null>(null);
  const [cloneMode, setCloneMode] = useState(false);
  const [cloneRepos, setCloneRepos] = useState<GitRepo[]>([]);
  const [cloneLoading, setCloneLoading] = useState(false);

  // Live port detected
  const [detectedPort, setDetectedPort] = useState<number | null>(null);

  const TERMINAL_HEIGHT = terminalExpanded ? 240 : 28;
  const SIDEBAR_WIDTH = showFileTree ? 180 : 0;
  const PREVIEW_WIDTH = showPreview ? '45%' : '0';
  const CHAT_WIDTH = 400;

  const loadFiles = useCallback(async (dir: string) => {
    try { setFiles(await window.api.files.readDir(dir)); } catch { setFiles([]); }
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    loadFiles(projectPath);
    window.api.terminal.create(projectPath);
    window.api.files.watch(projectPath);
    const cleanup = window.api.files.onChanged(() => loadFiles(projectPath));
    return cleanup;
  }, [projectPath, loadFiles]);

  // Collect terminal output for Preview server detection & IntelliChat
  useEffect(() => {
    const cleanup = window.api.terminal.onData((data: string) => {
      terminalOutputRef.current = (terminalOutputRef.current + data).split('\n').slice(-300).join('\n');
      setTerminalOutput(terminalOutputRef.current);

      // Detect server port for auto-showing preview
      // Covers: Next.js, Vite, CRA, Express, Fastify, Remix, Astro, etc.
      const portMatch =
        data.match(/(?:localhost|127\.0\.0\.1):(\d{4,5})/i) ||
        data.match(/Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i) ||
        data.match(/(?:started|running|listening|server).{0,40}?:(\d{4,5})/i) ||
        data.match(/(?:ready|available).{0,40}?port[:\s]+(\d{4,5})/i) ||
        data.match(/on port[:\s]+(\d{4,5})/i) ||
        data.match(/:\s*(\d{4,5})\s*(?:→|->|\()/i);
      if (portMatch) {
        const p = parseInt(portMatch[1], 10);
        if (p >= 1024 && p <= 65535) {
          setDetectedPort(p);
          setShowPreview(true);
        }
      }
    });

    // Handle terminal inject from voice
    const injectCleanup = window.api.terminal.onInject?.((text: string) => {
      window.api.terminal.write(text);
    });

    return () => { cleanup(); injectCleanup?.(); };
  }, []);

  useEffect(() => {
    window.api.github.authStatus()
      .then((s: { connected: boolean; user?: string }) => setGhStatus(s))
      .catch(() => setGhStatus({ connected: false }));
  }, []);

  async function handleConnectGithub() {
    await window.api.github.connectOAuth();
    const s = await window.api.github.authStatus();
    setGhStatus(s);
  }

  async function handleShowClone() {
    setCloneLoading(true);
    if (!ghStatus?.connected) {
      await handleConnectGithub();
    }
    try {
      const result = await window.api.github.listRepos();
      setCloneRepos((result?.repos || []) as GitRepo[]);
    } catch { setCloneRepos([]); }
    setCloneLoading(false);
    setCloneMode(true);
  }

  async function handleCloneRepo(repo: GitRepo) {
    const home = await window.api.files.getHome();
    const repoName = String(repo.name);
    const dest = `${home}/${repoName}`;
    const cloneUrl = `https://github.com/${String(repo.fullName)}.git`;
    setCloneLoading(true);
    await window.api.github.clone(cloneUrl, dest);
    setCloneLoading(false);
    setProjectPath(dest);
    setCloneMode(false);
  }

  async function handleOpenFolder() {
    const path = await window.api.files.openDialog();
    if (path) {
      setProjectPath(path);
      setOpenFile(null);
      setFileContent('');
      setModified(false);
    }
  }

  async function handleSelectFile(filePath: string) {
    if (modified && openFile) await handleSave();
    try {
      const content = await window.api.files.read(filePath);
      setOpenFile(filePath);
      setFileContent(content);
      setModified(false);
    } catch { /* not readable */ }
  }

  async function handleSave() {
    if (openFile && modified) {
      await window.api.files.write(openFile, fileContent);
      setModified(false);
    }
  }

  function handleContentChange(value: string | undefined) {
    if (value !== undefined) { setFileContent(value); setModified(true); }
  }

  function handleTerminalInject(text: string) {
    window.api.terminal.write(text);
  }

  function handleRunDev() {
    window.api.terminal.write('npm run dev\r');
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); }
      if (mod && e.key === 'b') { e.preventDefault(); setShowFileTree((v) => !v); }
      if (mod && e.key === 'j') { e.preventDefault(); setShowChat((v) => !v); }
      if (mod && e.key === '`') { e.preventDefault(); setTerminalExpanded((v) => !v); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openFile, fileContent, modified]);

  if (!projectPath) {
    return (
      <div style={styles.welcome}>
        <div style={styles.welcomeContent}>
          <span style={styles.logo}>∞</span>
          <h1 style={styles.title}>Infinit Code</h1>

          {cloneMode ? (
            <div style={styles.cloneList}>
              <div style={styles.cloneHeader}>
                <button style={styles.backBtn} onClick={() => setCloneMode(false)}>← Voltar</button>
                <span style={styles.cloneTitle}>Escolha um repositório</span>
              </div>
              {cloneLoading ? (
                <p style={styles.hintText}>Carregando repositórios...</p>
              ) : (
                <div style={styles.repoList}>
                  {cloneRepos.length === 0 && (
                    <p style={styles.hintText}>Nenhum repositório encontrado.</p>
                  )}
                  {cloneRepos.map((r, i) => (
                    <button
                      key={i}
                      style={styles.repoItem}
                      onClick={() => handleCloneRepo(r)}
                    >
                      {String(r.fullName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.actionCards}>
              <button style={styles.card} onClick={handleConnectGithub}>
                <span style={styles.cardIcon}>⚡</span>
                <span style={styles.cardLabel}>
                  {ghStatus?.connected ? `GitHub: ${ghStatus.user || 'Conectado'}` : 'Conectar GitHub'}
                </span>
                {ghStatus?.connected && <span style={styles.connectedDot} />}
              </button>

              <button style={styles.card} onClick={handleShowClone} disabled={cloneLoading}>
                <span style={styles.cardIcon}>⬇</span>
                <span style={styles.cardLabel}>Clonar Repositório</span>
              </button>

              <button style={{ ...styles.card, ...styles.cardPrimary }} onClick={handleOpenFolder}>
                <span style={styles.cardIcon}>📁</span>
                <span style={styles.cardLabel}>Abrir Pasta</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const fileName = openFile ? openFile.split('/').pop() || '' : '';

  return (
    <div style={styles.container}>
      <Toolbar
        projectPath={projectPath}
        fileName={fileName}
        modified={modified}
        onSave={handleSave}
        onOpenFolder={handleOpenFolder}
        onTogglePreview={() => setShowPreview((v) => !v)}
        onToggleChat={() => setShowChat((v) => !v)}
        onToggleGit={() => setShowGit((v) => !v)}
        showPreview={showPreview}
        showChat={showChat}
        showGit={showGit}
        gitChangeCount={gitChangeCount}
        livePort={detectedPort}
      />

      <div style={styles.main}>
        {/* File Tree */}
        {showFileTree && (
          <div style={{ ...styles.sidebar, width: SIDEBAR_WIDTH }}>
            <FileTree files={files} selectedFile={openFile} onSelectFile={handleSelectFile} />
          </div>
        )}

        {/* Editor + Terminal */}
        <div style={styles.editorArea}>
          <div style={{ ...styles.editorPane, height: `calc(100% - ${TERMINAL_HEIGHT}px)` }}>
            {openFile ? (
              <Editor filePath={openFile} content={fileContent} onChange={handleContentChange} />
            ) : (
              <div style={styles.noFile}><p style={styles.noFileText}>Selecione um arquivo para editar</p></div>
            )}
          </div>

          {/* Terminal */}
          <div style={{ ...styles.terminalPanel, height: TERMINAL_HEIGHT }}>
            <div
              style={styles.terminalHandle}
              onClick={() => setTerminalExpanded((v) => !v)}
              title="Cmd+` para toggle"
            >
              <span style={styles.terminalDot} />
              <span style={styles.terminalLabel}>Terminal</span>
              <span style={styles.terminalToggle}>{terminalExpanded ? '▼' : '▲'}</span>
            </div>
            {terminalExpanded && (
              <div style={styles.terminalBody}>
                <Terminal />
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div style={{ ...styles.panel, width: PREVIEW_WIDTH, minWidth: 280 }}>
            <Preview
              terminalOutput={terminalOutput}
              onRunDev={handleRunDev}
            />
          </div>
        )}

        {/* Git Panel */}
        {showGit && (
          <div style={{ ...styles.panel, width: 260 }}>
            <GitPanel
              projectPath={projectPath}
              onSyncProgress={(msg) => setTerminalOutput((prev) => prev + '\n[git] ' + msg)}
            />
          </div>
        )}

        {/* IntelliChat */}
        {showChat && (
          <div style={{ ...styles.panel, width: CHAT_WIDTH }}>
            <IntelliChat
              projectPath={projectPath}
              activeFile={openFile ? { path: openFile, content: fileContent } : null}
              onTerminalInject={handleTerminalInject}
              terminalOutput={terminalOutput}
              onOpenFile={handleSelectFile}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a' },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: { background: '#111', borderRight: '1px solid #1e1e1e', overflow: 'auto', flexShrink: 0 },
  editorArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' },
  editorPane: { overflow: 'hidden', flexShrink: 0 },
  terminalPanel: { borderTop: '1px solid #1e1e1e', background: '#0a0a0a', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  terminalHandle: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
    background: '#111', cursor: 'pointer', flexShrink: 0, userSelect: 'none',
    borderBottom: '1px solid #1e1e1e',
  },
  terminalDot: { width: 6, height: 6, borderRadius: '50%', background: '#00ff88', flexShrink: 0 },
  terminalLabel: { color: '#555', fontSize: 11, flex: 1 },
  terminalToggle: { color: '#333', fontSize: 10 },
  terminalBody: { flex: 1, overflow: 'hidden' },
  panel: { borderLeft: '1px solid #1e1e1e', flexShrink: 0, overflow: 'hidden' },
  noFile: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  noFileText: { color: '#333', fontSize: 13 },
  welcome: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' },
  welcomeContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 },
  logo: { fontSize: 72, color: '#00ff88', lineHeight: 1 },
  title: { fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 },
  actionCards: { display: 'flex', flexDirection: 'column', gap: 12, width: 320 },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#111', border: '1px solid #222', borderRadius: 10,
    padding: '16px 20px', cursor: 'pointer', color: '#ccc', fontSize: 15,
    fontWeight: 600, textAlign: 'left' as const, position: 'relative' as const,
    transition: 'border-color 0.15s',
  },
  cardPrimary: { background: '#00ff8815', border: '1px solid #00ff8840', color: '#00ff88' },
  cardIcon: { fontSize: 20, width: 28, textAlign: 'center' as const },
  cardLabel: { flex: 1 },
  connectedDot: { width: 8, height: 8, borderRadius: '50%', background: '#00ff88', flexShrink: 0 },
  cloneList: { width: 360, display: 'flex', flexDirection: 'column', gap: 12 },
  cloneHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', padding: 0 },
  cloneTitle: { color: '#888', fontSize: 14 },
  repoList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' as const },
  repoItem: {
    background: '#111', border: '1px solid #222', borderRadius: 8,
    padding: '12px 16px', cursor: 'pointer', color: '#ccc', fontSize: 13,
    textAlign: 'left' as const, fontFamily: 'monospace',
  },
  hintText: { color: '#444', fontSize: 13, textAlign: 'center' as const },
};
