import React, { useState, useEffect, useCallback, useRef } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
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
      const portMatch = data.match(/(?:localhost|127\.0\.0\.1):(\d{4,5})/i)
        || data.match(/Local:\s+http:\/\/localhost:(\d{4,5})/i);
      if (portMatch) {
        const p = parseInt(portMatch[1], 10);
        setDetectedPort(p);
        setShowPreview(true);
      }
    });

    // Handle terminal inject from voice
    const injectCleanup = window.api.terminal.onInject?.((text: string) => {
      window.api.terminal.write(text);
    });

    return () => { cleanup(); injectCleanup?.(); };
  }, []);

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
          <p style={styles.subtitle}>Abra uma pasta para começar</p>
          <button style={styles.openBtn} onClick={handleOpenFolder}>Abrir Pasta</button>
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
  welcomeContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 },
  logo: { fontSize: 72, color: '#00ff88', lineHeight: 1 },
  title: { fontSize: 32, fontWeight: 700, color: '#fff', margin: 0 },
  subtitle: { color: '#555', fontSize: 15, margin: 0 },
  openBtn: { background: '#00ff88', color: '#0a0a0a', border: 'none', padding: '13px 40px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};
