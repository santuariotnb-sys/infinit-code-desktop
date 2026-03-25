import React, { useEffect, useState, useRef } from 'react';

import FileTree from '../components/FileTree';
import Editor from '../components/Editor';
import Terminal from '../components/Terminal';
import Preview from '../components/Preview';
import IntelliChat from '../components/IntelliChat';
import AgentPanel from '../components/AgentPanel';
import Toolbar from '../components/Toolbar';
import GitPanel from '../components/GitPanel';
import Toast from '../components/Toast';
import CommandPalette from '../components/CommandPalette';
import SettingsDrawer from '../components/SettingsDrawer';
import GitHubAuthModal from '../components/GitHubAuthModal';

import { useFileManager } from '../hooks/useFileManager';
import { useTerminal } from '../hooks/useTerminal';
import { usePanels } from '../hooks/usePanels';
import { useProjectIndex } from '../hooks/useProjectIndex';
import { useGitHub } from '../hooks/useGitHub';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../hooks/useSettings';
import { ErrorBoundary } from '../components/ErrorBoundary';
import TabBar from '../components/TabBar';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

function makeDragH(
  ref: React.MutableRefObject<{ startX: number; startW: number } | null>,
  current: number,
  setter: (v: number) => void,
  min: number, max: number,
  invert = false,
) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    ref.current = { startX: e.clientX, startW: current };
    const onMove = (ev: MouseEvent) => {
      if (!ref.current) return;
      const delta = (ref.current.startX - ev.clientX) * (invert ? -1 : 1);
      setter(Math.max(min, Math.min(max, ref.current.startW + delta)));
    };
    const onUp = () => { ref.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
}

export default function IDE() {
  const panels = usePanels();
  const fileManager = useFileManager();
  const { projectContext } = useProjectIndex(fileManager.projectPath, fileManager.files);
  const terminal = useTerminal({
    onPortDetected: () => panels.setShowPreview(true),
  });
  const [gitChangeCount, setGitChangeCount] = useState(0);
  const github = useGitHub({ onProjectOpen: fileManager.openProject });

  // Track Claude streaming status for toolbar indicator
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  // Refresh do preview após git sync/pull
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);
  const triggerPreviewRefresh = () => setPreviewRefreshTrigger(n => n + 1);
  type ChatTab = 'chat' | 'research' | 'agents';
  const [chatTab, setChatTab] = useState<ChatTab>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const { toast } = useToast();
  const { settings, updateSetting } = useSettings();

  useKeyboardShortcuts({
    onSave: fileManager.handleSave,
    onToggleTerminal: () => terminal.setIsExpanded((v) => !v),
    onToggleFileTree: panels.toggleFileTree,
    onToggleChat: panels.toggleChat,
    onToggleGit: panels.toggleGit,
    onOpenPalette: () => setShowPalette(true),
    onOpenSettings: () => setShowSettings(true),
  });

  // Abre preview automaticamente quando projeto abre ou porta é detectada
  useEffect(() => {
    if (fileManager.projectPath) panels.setShowPreview(true);
  }, [fileManager.projectPath]);

  // runDevServer com package manager correto — usa ghost terminal (cwd obrigatório)
  const runDev = () => terminal.runDevServer(fileManager.pkgManager, fileManager.projectPath ?? undefined);

  useEffect(() => {
    if (terminal.detectedPort) panels.setShowPreview(true);
  }, [terminal.detectedPort]);

  const [previewWidth,   setPreviewWidth]   = useState(420);
  const [chatWidth,      setChatWidth]      = useState(300);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [sidebarWidth,   setSidebarWidth]   = useState(200);

  const previewDragRef  = useRef<{ startX: number; startW: number } | null>(null);
  const chatDragRef     = useRef<{ startX: number; startW: number } | null>(null);
  const terminalDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const sidebarDragRef  = useRef<{ startX: number; startW: number } | null>(null);

  function startTerminalDrag(e: React.MouseEvent) {
    e.preventDefault();
    terminalDragRef.current = { startY: e.clientY, startH: terminalHeight };
    const onMove = (ev: MouseEvent) => {
      if (!terminalDragRef.current) return;
      const delta = terminalDragRef.current.startY - ev.clientY;
      setTerminalHeight(Math.max(60, Math.min(600, terminalDragRef.current.startH + delta)));
    };
    const onUp = () => { terminalDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const startPreviewDrag = makeDragH(previewDragRef,  previewWidth,  setPreviewWidth,  280, 1000);
  const startChatDrag    = makeDragH(chatDragRef,     chatWidth,     setChatWidth,     220, 600);
  const startSidebarDrag = makeDragH(sidebarDragRef,  sidebarWidth,  setSidebarWidth,  120, 480, true);

  const TERMINAL_HEIGHT = terminal.isExpanded ? terminalHeight : 34;
  const SIDEBAR_WIDTH   = panels.showFileTree ? sidebarWidth : 0;
  const PREVIEW_WIDTH   = panels.showPreview  ? previewWidth : 0;
  const CHAT_WIDTH      = chatWidth;

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
        [data-resize]:hover { background: rgba(60,176,67,0.35) !important; }
        [data-resize]:active { background: rgba(60,176,67,0.55) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
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
        gitChangeCount={gitChangeCount}
        livePort={terminal.detectedPort}
        isChatStreaming={isChatStreaming}
        onOpenPalette={() => setShowPalette(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div style={styles.main}>
        {panels.showFileTree && (
          <div style={{ ...styles.sidebar, width: SIDEBAR_WIDTH, position: 'relative' }}>
            <ErrorBoundary name="FileTree">
              <FileTree
                files={fileManager.files}
                selectedFile={fileManager.openFile}
                onSelectFile={fileManager.handleSelectFile}
              />
            </ErrorBoundary>
            {/* Sidebar resize handle */}
            <div data-resize style={styles.resizeHandleV} onMouseDown={startSidebarDrag} title="Arraste para redimensionar" />
          </div>
        )}

        <div style={styles.editorArea}>
          {fileManager.openTabs.length > 0 && (
            <TabBar
              tabs={fileManager.openTabs}
              activeTab={fileManager.openFile || ''}
              onSelect={fileManager.handleSelectFile}
              onClose={fileManager.closeTab}
              isModified={fileManager.isModified}
            />
          )}
          {/* Editor + Preview side by side, both above Terminal */}
          <div style={styles.editorRow}>
          <div style={styles.editorPane}>
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
                      : github.cloneError
                        ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <p style={{ ...styles.noFileText, color: '#d04040' }}>Erro: {github.cloneError}</p>
                            <button style={styles.emptyBtn} onClick={github.handleShowClone}>↺ Tentar novamente</button>
                          </div>
                        )
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
              <div style={styles.noFile} />
            )}
          </div>

            {panels.showPreview && (
              <div style={{ display: 'flex', flexDirection: 'row', width: PREVIEW_WIDTH, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.55)', overflow: 'hidden' }}>
                <div
                  data-resize
                  style={styles.resizeHandle}
                  onMouseDown={startPreviewDrag}
                  title="Arraste para redimensionar"
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <ErrorBoundary name="Preview">
                    <Preview
                      terminalOutput={terminal.ghostOutput}
                      onRunDev={runDev}
                      projectPath={fileManager.projectPath}
                      hasNodeModules={fileManager.hasNodeModules}
                      pkgManager={fileManager.pkgManager}
                      refreshTrigger={previewRefreshTrigger}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            )}
          </div>{/* end editorRow */}

          <div style={{ ...styles.terminalPanel, height: TERMINAL_HEIGHT }}>
            {/* Terminal vertical resize handle */}
            {terminal.isExpanded && (
              <div data-resize style={styles.resizeHandleH} onMouseDown={startTerminalDrag} title="Arraste para redimensionar" />
            )}
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

        {panels.showChat && (
          <div style={{ ...styles.panel, width: CHAT_WIDTH, display: 'flex', flexDirection: 'row' }}>
          <div
            style={styles.resizeHandle}
            onMouseDown={startChatDrag}
            title="Arraste para redimensionar"
          />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            <div style={styles.chatTabs}>
              {([
                { id: 'chat',     icon: '⬡', label: 'Projeto' },
                { id: 'research', icon: '⌕', label: 'Pesquisa' },
                { id: 'agents',   icon: '🤖', label: 'Agentes' },
              ] as { id: ChatTab; icon: string; label: string }[]).map((tab) => (
                <button
                  key={tab.id}
                  style={{ ...styles.chatTab, ...(chatTab === tab.id ? styles.chatTabActive : {}) }}
                  onClick={() => setChatTab(tab.id)}
                >
                  <span style={{ fontSize: 11 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {chatTab === 'chat' && (
                <ErrorBoundary name="IntelliChat">
                  <IntelliChat
                    mode="project"
                    projectPath={fileManager.projectPath}
                    activeFile={fileManager.openFile
                      ? { path: fileManager.openFile, content: fileManager.fileContent }
                      : null}
                    onTerminalInject={terminal.writeToTerminal}
                    terminalOutput={terminal.terminalOutput}
                    onOpenFile={fileManager.handleSelectFile}
                    onStreamingChange={setIsChatStreaming}
                    projectContext={projectContext}
                  />
                </ErrorBoundary>
              )}
              {chatTab === 'research' && (
                <ErrorBoundary name="IntelliChat-research">
                  <IntelliChat
                    mode="research"
                    projectPath={fileManager.projectPath}
                    activeFile={null}
                    onTerminalInject={terminal.writeToTerminal}
                    terminalOutput=""
                    onOpenFile={fileManager.handleSelectFile}
                    onStreamingChange={setIsChatStreaming}
                    projectContext={projectContext}
                  />
                </ErrorBoundary>
              )}
              {chatTab === 'agents' && (
                <ErrorBoundary name="AgentPanel">
                  <AgentPanel
                    projectPath={fileManager.projectPath}
                    activeFile={fileManager.openFile ?? undefined}
                    activeFileContent={fileManager.openFile ? fileManager.fileContent : undefined}
                  />
                </ErrorBoundary>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      <Toast msg={toast?.msg || null} />
      <CommandPalette
        open={showPalette}
        onClose={() => setShowPalette(false)}
        onToggleFileTree={panels.toggleFileTree}
        onToggleChat={panels.toggleChat}
        onTogglePreview={panels.togglePreview}
        onToggleTerminal={() => terminal.setIsExpanded((v) => !v)}
        onToggleGit={panels.toggleGit}
        onRunDev={terminal.runDevServer}
        onOpenSettings={() => setShowSettings(true)}
        onOpenFolder={fileManager.handleOpenFolder}
      />
      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdate={updateSetting}
      />
      <ErrorBoundary name="GitPanel">
        <GitPanel
          open={panels.showGit}
          onClose={panels.toggleGit}
          projectPath={fileManager.projectPath}
          onSyncProgress={(msg) => {
            terminal.appendOutput(`[git] ${msg}`);
            if (msg.includes('done') || msg.includes('pulled') || msg.includes('pushed')) {
              triggerPreviewRefresh();
            }
          }}
          onConnect={() => github.setShowAuthModal(true)}
          onChangesUpdate={setGitChangeCount}
        />
      </ErrorBoundary>
      <GitHubAuthModal
        open={github.showAuthModal}
        onClose={() => github.setShowAuthModal(false)}
        onConnected={github.handleAuthConnected}
      />

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
        {isChatStreaming && (
          <>
            <span style={styles.sbItem}>Claude pensando...</span>
            <span style={styles.sbSep} />
          </>
        )}
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
  editorArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 320, position: 'relative' },
  editorRow: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 },
  editorPane: { flex: 1, overflow: 'hidden', minHeight: 0 },
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
  // Horizontal panel resize (col-resize) — borda esquerda de Preview/Chat
  resizeHandle: {
    width: 5, cursor: 'col-resize', flexShrink: 0,
    background: 'transparent', transition: 'background 0.15s', zIndex: 10,
  },
  // Vertical panel resize (col-resize) — borda direita da Sidebar
  resizeHandleV: {
    position: 'absolute' as const, top: 0, right: 0, bottom: 0,
    width: 5, cursor: 'col-resize', zIndex: 20,
    background: 'transparent', transition: 'background 0.15s',
  },
  // Horizontal strip resize (row-resize) — borda superior do Terminal
  resizeHandleH: {
    height: 5, cursor: 'row-resize', flexShrink: 0,
    background: 'transparent', transition: 'background 0.15s', zIndex: 10,
  },
  noFile: {
    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(240,241,245,0.5)',
  },
  noFileText: { color: '#a8aab4', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" },
  emptyProjectHint: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
  },
  shortcutList: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  shortcutRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    fontSize: 12, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace",
  },
  kbd: {
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 5,
    padding: '2px 7px',
    fontSize: 11,
    color: '#3a3d45',
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: '0 1px 0 rgba(0,0,0,0.12)',
    minWidth: 48,
    textAlign: 'center' as const,
    display: 'inline-block',
  },
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

  // Chat tabs
  chatTabs: {
    display: 'flex', flexShrink: 0,
    background: 'rgba(215,218,224,0.9)',
    borderBottom: '1px solid rgba(255,255,255,0.45)',
    padding: '6px 8px 0',
    gap: 2,
  },
  chatTab: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'transparent', border: 'none',
    borderRadius: '7px 7px 0 0', padding: '5px 10px',
    fontSize: 11, fontFamily: "'DM Sans', -apple-system, sans-serif",
    color: '#a8aab4', cursor: 'pointer',
    fontWeight: 400,
  },
  chatTabActive: {
    background: 'rgba(255,255,255,0.75)',
    color: '#2a2d35',
    fontWeight: 500,
    boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset',
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
