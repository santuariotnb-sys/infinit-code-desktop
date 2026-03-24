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
import { useGitHub } from '../hooks/useGitHub';
import { useGitPanel } from '../hooks/useGitPanel';
import { ErrorBoundary } from '../components/ErrorBoundary';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

interface IDEProps {
  onLogout?: () => void;
}

export default function IDE({ onLogout }: IDEProps) {
  const panels = usePanels();
  const fileManager = useFileManager();
  const terminal = useTerminal({
    onPortDetected: () => panels.setShowPreview(true),
  });
  const github = useGitHub({ onProjectOpen: fileManager.openProject });
  const gitPanel = useGitPanel();

  // Abre preview automaticamente quando porta é detectada
  useEffect(() => {
    if (terminal.detectedPort) panels.setShowPreview(true);
  }, [terminal.detectedPort]);

  const TERMINAL_HEIGHT = terminal.isExpanded ? 220 : 34;
  const SIDEBAR_WIDTH = panels.showFileTree ? 200 : 0;
  const PREVIEW_WIDTH = panels.showPreview ? '45%' : '0';
  const CHAT_WIDTH = 300;

  // Welcome screen — sem projeto aberto
  if (!fileManager.projectPath) {
    return (
      <div style={styles.welcome}>
        <div style={styles.welcomeContent}>
          <div style={styles.welcomeLogo}>
            <svg width="40" height="25" viewBox="0 0 24 15" fill="none">
              <path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none" />
              <path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none" />
              <path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.4" />
              <path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' as const }}>
            <h1 style={styles.welcomeTitle}>Infinit <span style={{ color: '#3CB043' }}>Code</span></h1>
            <p style={styles.welcomeSub}>Powered by Claude Code</p>
          </div>

          {github.isCloneMode ? (
            <div style={styles.cloneList}>
              <div style={styles.cloneHeader}>
                <button style={styles.backBtn} onClick={() => github.setIsCloneMode(false)}>← Voltar</button>
                <span style={styles.cloneTitle}>Escolha um repositório</span>
              </div>
              {github.isCloneLoading ? (
                <p style={styles.hintText}>Carregando repositórios...</p>
              ) : (
                <div style={styles.repoList}>
                  {github.cloneRepos.length === 0 && (
                    <p style={styles.hintText}>Nenhum repositório encontrado.</p>
                  )}
                  {github.cloneRepos.map((r, i) => (
                    <button
                      key={i}
                      style={styles.repoItem}
                      onClick={() => github.handleCloneRepo(r)}
                    >
                      {String(r.fullName)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.actionCards}>
              <button style={styles.card} onClick={github.handleConnectGitHub}>
                <div style={styles.cardIconWrap}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#3a3d45">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                </div>
                <span style={styles.cardLabel}>
                  {github.ghStatus?.connected
                    ? `GitHub: ${github.ghStatus.user || 'Conectado'}`
                    : 'Conectar GitHub'}
                </span>
                {github.ghStatus?.connected && <span style={styles.connectedDot} />}
              </button>

              <button style={styles.card} onClick={github.handleShowClone} disabled={github.isCloneLoading}>
                <div style={styles.cardIconWrap}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3 7l4 4 4-4" stroke="#3a3d45" strokeWidth="1.4" strokeLinecap="round" /><path d="M1 12h12" stroke="#3a3d45" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </div>
                <span style={styles.cardLabel}>Clonar Repositório</span>
              </button>

              <button style={{ ...styles.card, ...styles.cardPrimary }} onClick={fileManager.handleOpenFolder}>
                <div style={{ ...styles.cardIconWrap, background: 'rgba(60,176,67,0.15)' }}>
                  <svg width="16" height="14" viewBox="0 0 12 10" fill="none"><path d="M.5 2A1.5 1.5 0 0 1 2 .5h2.5L6 2H10A1.5 1.5 0 0 1 11.5 3.5v5A1.5 1.5 0 0 1 10 10H2A1.5 1.5 0 0 1 .5 8.5V2Z" stroke="#3CB043" strokeWidth="1" fill="none" /></svg>
                </div>
                <span style={{ ...styles.cardLabel, color: '#3CB043' }}>Abrir Pasta</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        onLogout={onLogout}
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

  // Welcome screen
  welcome: {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#dde0e5', backgroundImage: NOISE,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  welcomeContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 },
  welcomeLogo: {
    width: 72, height: 72,
    background: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 8px 32px rgba(0,0,0,0.12)',
  },
  welcomeTitle: {
    fontSize: 28, fontWeight: 300, color: '#3a3d45',
    margin: '0 0 4px', letterSpacing: '-.01em',
  },
  welcomeSub: { fontSize: 12, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace", margin: 0 },
  actionCards: { display: 'flex', flexDirection: 'column', gap: 10, width: 320 },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(20px)',
    border: 'none',
    borderRadius: 12,
    padding: '14px 16px', cursor: 'pointer', color: '#3a3d45', fontSize: 14,
    fontWeight: 400, textAlign: 'left' as const, position: 'relative' as const,
    boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 4px 16px rgba(0,0,0,0.07)',
    transition: 'all .15s',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  cardPrimary: {
    background: 'rgba(60,176,67,0.1)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(60,176,67,0.1)',
  },
  cardIconWrap: {
    width: 36, height: 36, borderRadius: 9,
    background: 'rgba(255,255,255,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset',
  },
  cardLabel: { flex: 1, fontWeight: 400 },
  connectedDot: { width: 7, height: 7, borderRadius: '50%', background: '#3CB043', flexShrink: 0 },
  cloneList: { width: 360, display: 'flex', flexDirection: 'column', gap: 12 },
  cloneHeader: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: {
    background: 'none', border: 'none', color: '#a8aab4',
    fontSize: 13, cursor: 'pointer', padding: 0,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  cloneTitle: { color: '#72757f', fontSize: 14 },
  repoList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' as const },
  repoItem: {
    background: 'rgba(255,255,255,0.55)', border: 'none', borderRadius: 8,
    padding: '12px 16px', cursor: 'pointer', color: '#3a3d45', fontSize: 12,
    textAlign: 'left' as const, fontFamily: "'JetBrains Mono', monospace",
    boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset',
  },
  hintText: { color: '#a8aab4', fontSize: 13, textAlign: 'center' as const, fontFamily: "'JetBrains Mono', monospace" },
};
