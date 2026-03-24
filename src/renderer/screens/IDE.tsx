import React, { useEffect } from 'react';

import FileTree from '../components/FileTree';
import Editor from '../components/Editor';
import Terminal from '../components/Terminal';
import Preview from '../components/Preview';
import IntelliChat from '../components/IntelliChat';
import Toolbar from '../components/Toolbar';
import GitPanel from '../components/GitPanel';

import { useFileManager } from '../hooks/useFileManager';
import { useTerminal } from '../hooks/useTerminal';
import { usePanels } from '../hooks/usePanels';
import { useGitPanel } from '../hooks/useGitPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

export default function IDE() {
  const panels = usePanels();
  const fileManager = useFileManager();
  const terminal = useTerminal({
    onPortDetected: () => panels.setShowPreview(true),
  });
  const gitPanel = useGitPanel();

  // Abre preview automaticamente quando porta é detectada
  useEffect(() => {
    if (terminal.detectedPort) panels.setShowPreview(true);
  }, [terminal.detectedPort]);

  const TERMINAL_HEIGHT = terminal.isExpanded ? 220 : 34;
  const SIDEBAR_WIDTH = panels.showFileTree ? 200 : 0;
  const PREVIEW_WIDTH = panels.showPreview ? '45%' : '0';
  const CHAT_WIDTH = 300;

  const fileName = fileManager.openFile
    ? fileManager.openFile.split('/').pop() || ''
    : '';

  return (
    <div style={styles.container}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 2px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <Toolbar
        projectPath={fileManager.projectPath}
        fileName={fileName}
        modified={fileManager.isModified}
        onSave={fileManager.handleSave}
        onOpenFolder={fileManager.handleOpenFolder}
        onTogglePreview={panels.togglePreview}
        onToggleChat={panels.toggleChat}
        onToggleGit={panels.toggleGit}
        onToggleFileTree={panels.toggleFileTree}
        onToggleTerminal={() => terminal.setIsExpanded((v) => !v)}
        onRunDev={terminal.runDevServer}
        showPreview={panels.showPreview}
        showChat={panels.showChat}
        showGit={panels.showGit}
        showFileTree={panels.showFileTree}
        showTerminal={terminal.isExpanded}
        gitChangeCount={gitPanel.gitChangeCount}
        livePort={terminal.detectedPort}
      />

      <div style={styles.main}>
        {panels.showFileTree && (
          <div style={{ ...styles.sidebar, width: SIDEBAR_WIDTH }}>
            <ErrorBoundary name="FileTree">
              <FileTree
                files={fileManager.files}
                selectedFile={fileManager.openFile}
                onSelectFile={fileManager.handleSelectFile}
              />
            </ErrorBoundary>
          </div>
        )}

        <div style={styles.editorArea}>
          <div style={{ ...styles.editorPane, height: `calc(100% - ${TERMINAL_HEIGHT}px)` }}>
            {fileManager.openFile ? (
              <ErrorBoundary name="Editor">
                <Editor
                  filePath={fileManager.openFile}
                  content={fileManager.fileContent}
                  onChange={fileManager.handleContentChange}
                />
              </ErrorBoundary>
            ) : (
              <div style={styles.noFile}>
                <p style={styles.noFileText}>Selecione um arquivo para editar</p>
              </div>
            )}
          </div>

          <div style={{ ...styles.terminalPanel, height: TERMINAL_HEIGHT }}>
            <div
              style={styles.terminalHandle}
              onClick={() => terminal.setIsExpanded((v) => !v)}
              title="Cmd+` para toggle"
            >
              <span style={styles.terminalDot} />
              <span style={styles.terminalTabOn}>bash</span>
              <span style={{ flex: 1 }} />
              <span style={styles.terminalToggle}>{terminal.isExpanded ? '▾' : '▴'}</span>
            </div>
            {terminal.isExpanded && (
              <div style={styles.terminalBody}>
                <ErrorBoundary name="Terminal">
                  <Terminal />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>

        {panels.showPreview && (
          <div style={{ ...styles.panel, width: PREVIEW_WIDTH, minWidth: 280 }}>
            <ErrorBoundary name="Preview">
              <Preview
                terminalOutput={terminal.terminalOutput}
                onRunDev={terminal.runDevServer}
              />
            </ErrorBoundary>
          </div>
        )}

        {panels.showGit && (
          <div style={{ ...styles.panel, width: 280 }}>
            <ErrorBoundary name="GitPanel">
              <GitPanel
                projectPath={fileManager.projectPath}
                onSyncProgress={(msg) => terminal.appendOutput(`[git] ${msg}`)}
              />
            </ErrorBoundary>
          </div>
        )}

        {panels.showChat && (
          <div style={{ ...styles.panel, width: CHAT_WIDTH }}>
            <ErrorBoundary name="IntelliChat">
              <IntelliChat
                projectPath={fileManager.projectPath}
                activeFile={fileManager.openFile
                  ? { path: fileManager.openFile, content: fileManager.fileContent }
                  : null}
                onTerminalInject={terminal.writeToTerminal}
                terminalOutput={terminal.terminalOutput}
                onOpenFile={fileManager.handleSelectFile}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <span style={styles.sbItem}>Infinit Code</span>
        <span style={styles.sbSep} />
        <span style={styles.sbItem}>{fileManager.projectPath?.split('/').pop()}</span>
        {terminal.detectedPort && (
          <>
            <span style={styles.sbSep} />
            <span style={styles.sbItem}>localhost:{terminal.detectedPort}</span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {fileName && <span style={styles.sbItem}>{fileName}</span>}
        {fileManager.isModified && (
          <>
            <span style={styles.sbSep} />
            <span style={styles.sbItem}>●</span>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh', display: 'flex', flexDirection: 'column',
    background: '#dde0e5',
    backgroundImage: NOISE,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  main: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  sidebar: {
    background: 'rgba(210,214,220,0.6)',
    borderRight: '1px solid rgba(255,255,255,0.55)',
    overflow: 'auto', flexShrink: 0,
  },
  editorArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' },
  editorPane: { overflow: 'hidden', flexShrink: 0 },
  terminalPanel: {
    borderTop: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(22,24,30,0.92)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  terminalHandle: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px',
    height: 34, background: 'rgba(30,33,40,0.95)',
    cursor: 'pointer', flexShrink: 0, userSelect: 'none' as const,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  terminalDot: { width: 5, height: 5, borderRadius: '50%', background: '#3CB043', flexShrink: 0 },
  terminalTabOn: {
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.08)',
    padding: '2px 10px', borderRadius: 5,
  },
  terminalToggle: { color: 'rgba(255,255,255,0.2)', fontSize: 10 },
  terminalBody: { flex: 1, overflow: 'hidden' },
  panel: { borderLeft: '1px solid rgba(255,255,255,0.55)', flexShrink: 0, overflow: 'hidden' },
  noFile: {
    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(240,241,245,0.5)',
  },
  noFileText: { color: '#a8aab4', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" },

  // Status bar
  statusBar: {
    height: 22, flexShrink: 0,
    background: 'rgba(60,176,67,0.85)',
    display: 'flex', alignItems: 'center',
    padding: '0 8px', gap: 0,
  },
  sbItem: {
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
    color: 'rgba(255,255,255,0.85)',
    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
    padding: '0 6px',
  },
  sbSep: { width: 1, height: 12, background: 'rgba(255,255,255,0.3)', margin: '0 2px', flexShrink: 0 },

};
