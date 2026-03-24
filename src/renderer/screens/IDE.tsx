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
import { useGitHub } from '../hooks/useGitHub';
import { ErrorBoundary } from '../components/ErrorBoundary';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

export default function IDE() {
  const panels = usePanels();
  const fileManager = useFileManager();
  const terminal = useTerminal({
    onPortDetected: () => panels.setShowPreview(true),
  });
  const gitPanel = useGitPanel();
  const github = useGitHub({ onProjectOpen: fileManager.openProject });

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
            ) : !fileManager.projectPath ? (
              <div style={styles.noFile}>
                {github.isCloneMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <button style={styles.emptyBtn} onClick={() => github.setIsCloneMode(false)}>← Voltar</button>
                      <span style={{ fontSize: 13, color: '#8a8d96' }}>Escolha um repositório</span>
                    </div>
                    {github.isCloneLoading
                      ? <p style={styles.noFileText}>Carregando repositórios...</p>
                      : github.cloneRepos.length === 0
                        ? <p style={styles.noFileText}>Nenhum repositório encontrado.</p>
                        : github.cloneRepos.map((r, i) => (
                            <button key={i} style={styles.emptyBtnRepo} onClick={() => github.handleCloneRepo(r)}>
                              {String(r.fullName)}
                            </button>
                          ))
                    }
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <button style={styles.emptyBtnPrimary} onClick={fileManager.handleOpenFolder}>
                      <svg width="14" height="12" viewBox="0 0 12 10" fill="none"><path d="M.5 2A1.5 1.5 0 0 1 2 .5h2.5L6 2H10A1.5 1.5 0 0 1 11.5 3.5v5A1.5 1.5 0 0 1 10 10H2A1.5 1.5 0 0 1 .5 8.5V2Z" stroke="#3CB043" strokeWidth="1" fill="none"/></svg>
                      Abrir Pasta
                    </button>
                    <button style={styles.emptyBtn} onClick={github.handleShowClone} disabled={github.isCloneLoading}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M1 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      Clonar Repositório
                    </button>
                    <button style={styles.emptyBtn} onClick={github.handleConnectGitHub}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
                      {github.ghStatus?.connected ? `GitHub: ${github.ghStatus.user || 'Conectado'}` : 'Conectar GitHub'}
                      {github.ghStatus?.connected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3CB043', display: 'inline-block', marginLeft: 4 }} />}
                    </button>
                  </div>
                )}
              </div>
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
  emptyBtnPrimary: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(60,176,67,0.1)', border: '1px solid rgba(60,176,67,0.25)',
    borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
    color: '#3CB043', fontSize: 13, fontWeight: 500,
    fontFamily: "-apple-system, sans-serif", width: 220, justifyContent: 'center',
  },
  emptyBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
    color: '#5a5d66', fontSize: 13, fontWeight: 400,
    fontFamily: "-apple-system, sans-serif", width: 220, justifyContent: 'center',
  },
  emptyBtnRepo: {
    background: 'rgba(255,255,255,0.55)', border: 'none', borderRadius: 8,
    padding: '10px 14px', cursor: 'pointer', color: '#3a3d45', fontSize: 12,
    textAlign: 'left' as const, fontFamily: "'JetBrains Mono', monospace", width: '100%',
  },

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
