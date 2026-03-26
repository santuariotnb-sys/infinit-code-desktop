import React, { useEffect, useState, useRef, useCallback } from 'react';

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
import { HealthIndicator } from '../components/HealthIndicator';
import { BroadcastBanner } from '../components/BroadcastBanner';

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
  const { projectContext, isIndexing, reindex } = useProjectIndex(fileManager.projectPath, fileManager.files);
  const handlePortDetected = useCallback(() => panels.setShowPreview(true), [panels.setShowPreview]);
  const terminal = useTerminal({ onPortDetected: handlePortDetected });
  const [gitChangeCount, setGitChangeCount] = useState(0);
  const github = useGitHub({ onProjectOpen: fileManager.openProject });

  // Track Claude streaming status for toolbar indicator
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  // Página atualmente visível no preview (rota + porta)
  const [previewPage, setPreviewPage] = useState<{ path: string; port: number | null }>({ path: '/', port: null });
  // Refresh do preview após git sync/pull
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);
  const triggerPreviewRefresh = () => setPreviewRefreshTrigger(n => n + 1);
  // Aguarda Vite recompilar após git sync antes de recarregar o iframe
  const triggerPreviewRefreshDelayed = () => {
    // 1º reload: após 2.5s (Vite detecta e compila os arquivos novos)
    setTimeout(() => setPreviewRefreshTrigger(n => n + 1), 2500);
    // 2º reload de segurança: após 5s (caso a primeira ainda pegue cache)
    setTimeout(() => setPreviewRefreshTrigger(n => n + 1), 5000);
    // 3º reload: após 9s (projetos grandes com muitos arquivos alterados)
    setTimeout(() => setPreviewRefreshTrigger(n => n + 1), 9000);
  };
  const handlePreviewPathChange = useCallback((path: string, port: number | null) => {
    setPreviewPage({ path, port });
  }, []);

  type ChatTab = 'chat' | 'research' | 'agents';
  const [chatTab, setChatTab] = useState<ChatTab>('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const { toast } = useToast();
  const { settings, updateSetting } = useSettings();

  // ── Voz nativa Claude CLI ────────────────────────────────────
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState<boolean | null>(null);

  useEffect(() => {
    window.api.claude.voiceStatus?.()
      .then((s: { supported: boolean }) => setIsVoiceSupported(s.supported))
      .catch(() => setIsVoiceSupported(false));
  }, []);

  const handleVoice = useCallback(async () => {
    if (!isVoiceSupported) return;
    // Garante que terminal está visível para o usuário ver a voz
    terminal.setIsExpanded(true);
    // Escreve configurações pt-BR e inicia /voice no terminal
    await window.api.claude.writeVoiceSettings?.();
    await window.api.claude.voiceStart?.();
    setIsVoiceActive(true);
    // Voz nativa do Claude não tem callback de fim — reseta indicador após 30s
    setTimeout(() => setIsVoiceActive(false), 30_000);
  }, [isVoiceSupported, terminal.setIsExpanded]);

  useKeyboardShortcuts({
    onSave: fileManager.handleSave,
    onToggleTerminal: () => terminal.setIsExpanded((v) => !v),
    onToggleFileTree: panels.toggleFileTree,
    onToggleChat: panels.toggleChat,
    onToggleGit: panels.toggleGit,
    onOpenPalette: () => setShowPalette(true),
    onOpenSettings: () => setShowSettings(true),
    onVoice: handleVoice,
  });

  // Abre preview automaticamente quando projeto abre ou porta é detectada
  useEffect(() => {
    if (fileManager.projectPath) panels.setShowPreview(true);
  }, [fileManager.projectPath]);

  // runDevServer com package manager correto — memoizado para não disparar effects no Preview
  const runDev = useCallback(
    () => terminal.runDevServer(fileManager.pkgManager, fileManager.projectPath ?? undefined),
    [terminal.runDevServer, fileManager.pkgManager, fileManager.projectPath],
  );

  useEffect(() => {
    if (terminal.detectedPort) panels.setShowPreview(true);
  }, [terminal.detectedPort]);

  // previewRatio: fração do editorRow que o Preview ocupa (0..1)
  // Editor recebe (1 - previewRatio) automaticamente → proporcional ao redimensionar chat
  const [previewRatio,   setPreviewRatio]   = useState(0.38);
  const [chatWidth,      setChatWidth]      = useState(300);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [sidebarWidth,   setSidebarWidth]   = useState(200);

  const editorRowRef    = useRef<HTMLDivElement>(null);
  const previewDragRef  = useRef<{ startX: number; startRatio: number; containerW: number } | null>(null);
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

  function startPreviewDrag(e: React.MouseEvent) {
    e.preventDefault();
    const containerW = editorRowRef.current?.clientWidth ?? 700;
    previewDragRef.current = { startX: e.clientX, startRatio: previewRatio, containerW };
    const onMove = (ev: MouseEvent) => {
      if (!previewDragRef.current) return;
      const { startX, startRatio, containerW: cw } = previewDragRef.current;
      const delta = startX - ev.clientX; // arrastar esquerda → preview maior
      const newPreviewW = cw * startRatio - delta;
      // Editor mín 300px, Preview mín 280px
      const clamped = Math.max(280, Math.min(cw - 300, newPreviewW));
      setPreviewRatio(clamped / cw);
    };
    const onUp = () => {
      previewDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const startChatDrag    = makeDragH(chatDragRef,    chatWidth,    setChatWidth,    220, 600);
  const startSidebarDrag = makeDragH(sidebarDragRef, sidebarWidth, setSidebarWidth, 120, 480, true);

  const TERMINAL_HEIGHT = terminal.isExpanded ? terminalHeight : 34;
  const SIDEBAR_WIDTH   = panels.showFileTree ? sidebarWidth : 0;
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
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Broadcast — notificações in-app do backend */}
      <BroadcastBanner />

      {/* Health indicator — canto inferior esquerdo */}
      <div style={{ position: 'fixed', bottom: 6, left: 8, zIndex: 999 }}>
        <HealthIndicator />
      </div>

      {/* Toast de erro de arquivo */}
      {fileManager.fileError && (
        <div style={{ position: 'fixed', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'rgba(217,48,48,0.95)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontFamily: 'monospace', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'slideDown .2s ease', pointerEvents: 'none' }}>
          ⚠ {fileManager.fileError}
        </div>
      )}

      <Toolbar
        projectPath={fileManager.projectPath}
        fileName={fileName}
        modified={fileManager.isModified}
        onSave={fileManager.handleSave}
        onOpenFolder={fileManager.handleOpenFolder}
        onSwitchRepo={github.handleShowClone}
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
        isGitHubConnected={github.ghStatus?.connected}
        gitHubUser={github.ghStatus?.user}
        onGitHubSwitchAccount={() => github.setShowAuthModal(true)}
        onGitHubDisconnect={github.handleDisconnect}
        onVoiceClick={handleVoice}
        isVoiceActive={isVoiceActive}
        isVoiceSupported={isVoiceSupported ?? true}
      />

      <div style={styles.main}>
        {panels.showFileTree && (
          <div style={{ ...styles.sidebar, width: SIDEBAR_WIDTH, position: 'relative' }}>
            <ErrorBoundary name="FileTree">
              <FileTree
                files={fileManager.files}
                selectedFile={fileManager.openFile}
                onSelectFile={fileManager.handleSelectFile}
                projectPath={fileManager.projectPath}
                onCreated={fileManager.reloadTree}
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
          <div ref={editorRowRef} style={styles.editorRow}>
          <div style={{ ...styles.editorPane, flex: panels.showPreview && !fileManager.openFile ? 0 : panels.showPreview ? 1 - previewRatio : 1, minWidth: panels.showPreview && !fileManager.openFile ? 0 : 300, overflow: 'hidden' }}>
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
                      ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                          <p style={styles.noFileText}>Clonando repositório...</p>
                          <button style={styles.emptyBtn} onClick={github.handleCancelClone}>✕ Cancelar</button>
                        </div>
                      )
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
              <div style={{ display: 'flex', flexDirection: 'row', flex: fileManager.openFile ? previewRatio : 1, minWidth: 280, borderLeft: fileManager.openFile ? '1px solid rgba(255,255,255,0.55)' : 'none', overflow: 'hidden' }}>
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
                      onPathChange={handlePreviewPathChange}
                      serverPort={terminal.detectedPort}
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
              <button
                onClick={(e) => { e.stopPropagation(); window.api.terminal.restart(); }}
                title="Reiniciar terminal"
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: '0 6px', transition: 'color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffaa00')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
              >↻</button>
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
                    isIndexing={isIndexing}
                    onReindex={reindex}
                    previewPage={previewPage.path}
                    previewPort={previewPage.port}
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
          onSyncProgress={(msg) => terminal.appendOutput(`[git] ${msg}`)}
          onSyncDone={triggerPreviewRefreshDelayed}
          onConnect={() => github.setShowAuthModal(true)}
          onChangesUpdate={setGitChangeCount}
        />
      </ErrorBoundary>
      <GitHubAuthModal
        open={github.showAuthModal}
        onClose={() => github.setShowAuthModal(false)}
        onConnected={github.handleAuthConnected}
      />

      {/* Modal: Trocar Repositório — aparece quando projeto já está aberto */}
      {github.isCloneMode && fileManager.projectPath && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) github.setIsCloneMode(false); }}
        >
          <div style={{
            background: 'rgba(235,237,242,0.97)', borderRadius: 14,
            boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 24px 64px rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.6)',
            width: 380, maxHeight: '70vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1c20', fontFamily: '-apple-system, sans-serif' }}>Trocar Repositório</span>
              <button onClick={() => github.setIsCloneMode(false)} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', color: '#666', fontSize: 12 }}>✕</button>
            </div>
            {/* Content */}
            <div style={{ padding: '12px 16px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ ...styles.emptyBtnPrimary, width: '100%', justifyContent: 'flex-start' }} onClick={() => { github.setIsCloneMode(false); fileManager.handleOpenFolder(); }}>
                <svg width="14" height="12" viewBox="0 0 12 10" fill="none"><path d="M.5 2A1.5 1.5 0 0 1 2 .5h2.5L6 2H10A1.5 1.5 0 0 1 11.5 3.5v5A1.5 1.5 0 0 1 10 10H2A1.5 1.5 0 0 1 .5 8.5V2Z" stroke="#3CB043" strokeWidth="1" fill="none"/></svg>
                Abrir pasta local
              </button>
              {github.isCloneLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 13, fontFamily: '-apple-system, sans-serif' }}>
                  {github.cloneRepos.length === 0 ? 'Carregando repositórios...' : 'Clonando...'}
                </div>
              ) : github.cloneError ? (
                <div style={{ color: '#d04040', fontSize: 12, fontFamily: '-apple-system, sans-serif' }}>
                  Erro: {github.cloneError}
                  <br /><button style={{ marginTop: 8, ...styles.emptyBtn, width: '100%' }} onClick={github.handleShowClone}>↺ Tentar novamente</button>
                </div>
              ) : github.cloneRepos.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Seus repositórios</div>
                  {github.cloneRepos.map((r, i) => (
                    <button key={i} style={styles.emptyBtnRepo} onClick={() => github.handleCloneRepo(r)}>
                      {String(r.fullName)}
                    </button>
                  ))}
                </>
              ) : (
                <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '12px 0', fontFamily: '-apple-system, sans-serif' }}>Nenhum repositório encontrado.</div>
              )}
            </div>
          </div>
        </div>
      )}

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
        {fileManager.isSaving && (
          <>
            <span style={styles.sbSep} />
            <span style={{ ...styles.sbItem, opacity: 0.7 }}>salvando...</span>
          </>
        )}
        {!fileManager.isSaving && fileManager.isModified && (
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
