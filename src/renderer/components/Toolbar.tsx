import React, { useState, useEffect, useRef } from 'react';

interface ToolbarProps {
  projectPath: string;
  fileName: string;
  modified: boolean;
  onSave: () => void;
  onOpenFolder: () => void;
  onSwitchRepo?: () => void;
  onTogglePreview: () => void;
  onToggleChat: () => void;
  onToggleGit: () => void;
  onToggleFileTree: () => void;
  onToggleTerminal: () => void;
  onRunDev: () => void;
  showPreview: boolean;
  showChat: boolean;
  showGit: boolean;
  showFileTree: boolean;
  showTerminal: boolean;
  gitChangeCount: number;
  gitBranch?: string;
  livePort: number | null;
  onLogout?: () => void;
  isChatStreaming?: boolean;
  onOpenPalette?: () => void;
  onOpenSettings?: () => void;
  isGitHubConnected?: boolean;
  gitHubUser?: string;
  onGitHubSwitchAccount?: () => void;
  onGitHubDisconnect?: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

export default function Toolbar({
  projectPath, fileName, modified, onSave, onOpenFolder, onSwitchRepo,
  onTogglePreview, onToggleChat, onToggleGit, onToggleFileTree, onToggleTerminal, onRunDev,
  showPreview, showChat, showGit, showFileTree, showTerminal,
  gitChangeCount, gitBranch = 'main', livePort, onLogout, isChatStreaming,
  onOpenPalette, onOpenSettings,
  isGitHubConnected, gitHubUser, onGitHubSwitchAccount, onGitHubDisconnect,
}: ToolbarProps) {
  const projectName = projectPath ? (projectPath.split('/').pop() || projectPath) : '';
  const [session, setSession] = useState<{ name: string; avatar: string } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showGitHubMenu, setShowGitHubMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const gitHubMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.api.auth.getSession().then((s) => {
      if (s) setSession({ name: s.name, avatar: s.avatar });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) setShowProjectMenu(false);
      if (gitHubMenuRef.current && !gitHubMenuRef.current.contains(e.target as Node)) setShowGitHubMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pill = (active: boolean, green?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: green
      ? 'rgba(60,176,67,0.12)'
      : active
        ? 'rgba(255,255,255,0.75)'
        : 'rgba(255,255,255,0.52)',
    border: 'none',
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 11,
    color: green ? '#3CB043' : active ? '#1a1c20' : '#72757f',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: active
      ? '0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 12px rgba(0,0,0,0.06)'
      : '0 1px 0 rgba(255,255,255,0.85) inset, 0 2px 6px rgba(0,0,0,0.07)',
    transition: 'all .15s',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    // @ts-expect-error electron no-drag
    WebkitAppRegion: 'no-drag',
  });

  const sep: React.CSSProperties = { width: 1, height: 20, background: 'rgba(255,255,255,0.55)', margin: '0 2px', flexShrink: 0 };

  return (
    <div style={styles.bar}>
      {/* Logo */}
      <div style={styles.logoBox} onClick={onOpenFolder} title="Abrir pasta">
        <svg width="16" height="10" viewBox="0 0 24 15" fill="none" style={{ position: 'relative', zIndex: 2 }}>
          <path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.6" fill="none" />
          <path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.6" fill="none" />
          <path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.6" />
          <path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Project path com dropdown para trocar */}
      <div ref={projectMenuRef} style={{ position: 'relative', flexShrink: 0, // @ts-expect-error no-drag
        WebkitAppRegion: 'no-drag' }}>
        <div
          style={{ ...styles.projectPath, cursor: 'pointer' }}
          onClick={() => setShowProjectMenu((v) => !v)}
          title="Trocar projeto"
        >
          <span style={{ color: '#72757f' }}>~/</span>
          <span style={styles.projectName}>{projectName || 'sem projeto'}</span>
          {fileName && (
            <>
              <span style={{ color: '#c8cad4' }}> / </span>
              <span style={{ color: '#3a3d45', fontWeight: 400 }}>{fileName}</span>
              {modified && <span style={styles.modDot}>●</span>}
            </>
          )}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginLeft: 3, opacity: 0.4 }}>
            <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        {showProjectMenu && (
          <div style={styles.dropMenu}>
            <button style={styles.dropItem} onClick={() => { setShowProjectMenu(false); onOpenFolder(); }}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M.5 2A1.5 1.5 0 0 1 2 .5h2.5L6 2H10A1.5 1.5 0 0 1 11.5 3.5v5A1.5 1.5 0 0 1 10 10H2A1.5 1.5 0 0 1 .5 8.5V2Z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
              Abrir pasta local
            </button>
            <button style={styles.dropItem} onClick={() => { setShowProjectMenu(false); onSwitchRepo?.(); }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
              Clonar repositório
            </button>
          </div>
        )}
      </div>

      <div style={sep} />

      {/* Panel toggles */}
      <button style={pill(showFileTree)} onClick={onToggleFileTree} title="Cmd+B">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 2h9M1 5.5h6M1 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        Arquivos
      </button>

      <button style={pill(showChat)} onClick={onToggleChat} title="Cmd+J">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 1.5h8v6.5H5l-3 2v-2H1.5z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" /></svg>
        Chat
        {isChatStreaming && (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f0a020', animation: 'tbPulse 1s infinite', flexShrink: 0 }} />
        )}
      </button>

      <button style={pill(showPreview)} onClick={onTogglePreview} title="Preview">
        {livePort ? (
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3CB043', animation: 'tbPulse 2s infinite', flexShrink: 0 }} />
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="2" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
        )}
        Preview{livePort ? ` :${livePort}` : ''}
      </button>

      <button style={pill(showTerminal)} onClick={onToggleTerminal} title="Cmd+`">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 3l3 2.5-3 2.5M5.5 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        Terminal
      </button>

      <div style={sep} />

      <button style={pill(false, true)} onClick={onRunDev} title="npm run dev">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 1.5L8.5 5 2 8.5z" fill="#3CB043" /></svg>
        npm run dev
      </button>

      <div style={{ flex: 1 }} />

      {/* Save indicator */}
      {modified && (
        <button
          style={{ ...pill(true), background: '#3CB043', color: 'white', boxShadow: '0 2px 10px rgba(60,176,67,0.25)' }}
          onClick={onSave}
          title="Salvar (Cmd+S)"
        >
          Salvar
        </button>
      )}

      {/* Git badge — com menu quando GitHub conectado */}
      <div ref={gitHubMenuRef} style={{ position: 'relative', flexShrink: 0, // @ts-expect-error no-drag
        WebkitAppRegion: 'no-drag' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 7,
            background: isGitHubConnected ? 'rgba(60,176,67,0.1)' : 'rgba(255,255,255,0.52)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.85) inset, 0 2px 6px rgba(0,0,0,0.07)',
            fontSize: 11, color: '#72757f', fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer', transition: 'all .15s',
            border: isGitHubConnected ? '1px solid rgba(60,176,67,0.2)' : '1px solid transparent',
          }}
          onClick={() => isGitHubConnected ? setShowGitHubMenu((v) => !v) : onToggleGit()}
          title={isGitHubConnected ? `GitHub: ${gitHubUser || 'conectado'} — clique para opções` : 'Painel Git'}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill={isGitHubConnected ? '#3CB043' : '#72757f'}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {isGitHubConnected && gitHubUser
            ? <span style={{ color: '#3CB043', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{gitHubUser}</span>
            : <span style={{ color: '#3a3d45' }}>{gitBranch}</span>
          }
          {gitChangeCount > 0 && (
            <span style={{ color: '#3CB043', fontSize: 10 }}>●{gitChangeCount}</span>
          )}
          {isGitHubConnected && (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.5 }}>
              <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
        </div>
        {showGitHubMenu && isGitHubConnected && (
          <div style={{ ...styles.dropMenu, right: 0, left: 'auto', minWidth: 180 }}>
            <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(0,0,0,0.06)', // @ts-expect-error no-drag
              WebkitAppRegion: 'no-drag' }}>
              <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>GitHub</div>
              {gitHubUser && <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1c20', marginTop: 2 }}>{gitHubUser}</div>}
            </div>
            <button style={styles.dropItem} onClick={() => { setShowGitHubMenu(false); onToggleGit(); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6 1v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              Abrir painel Git
            </button>
            <button style={styles.dropItem} onClick={() => { setShowGitHubMenu(false); onGitHubSwitchAccount?.(); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.1" /><path d="M1 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
              Trocar conta
            </button>
            <button style={{ ...styles.dropItem, color: '#d44' }} onClick={() => { setShowGitHubMenu(false); onGitHubDisconnect?.(); }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 4.5L10 7m0 0L7.5 9.5M10 7H4M5 2H2.5A1.5 1.5 0 0 0 1 3.5v5A1.5 1.5 0 0 0 2.5 10H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              Sair do GitHub
            </button>
          </div>
        )}
      </div>

      {/* Voice button */}
      <button
        style={{ ...pill(false), // @ts-expect-error no-drag
          WebkitAppRegion: 'no-drag' }}
        title="Voz PT-BR (⌘⇧V)"
      >
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
          <rect x="3" y=".5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M1 6.5C1 9 2.8 11 5.5 11s4.5-2 4.5-4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M5.5 11v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        Voz
      </button>

      {/* Command palette pill */}
      <button
        style={{ ...pill(false), // @ts-expect-error no-drag
          WebkitAppRegion: 'no-drag' }}
        onClick={onOpenPalette}
        title="⌘K"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M7.5 7.5l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        ⌘K
      </button>

      <div style={sep} />

      {/* Settings icon button */}
      <button
        onClick={onOpenSettings}
        title="Configurações (⌘,)"
        style={{
          width: 28, height: 28,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: '#a8aab4',
          transition: 'all .15s',
          flexShrink: 0,
          // @ts-expect-error no-drag
          WebkitAppRegion: 'no-drag',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 1v1.3M7 11.7V13M1 7h1.3M11.7 7H13M2.8 2.8l.9.9M10.3 10.3l.9.9M10.3 2.8l-.9.9M2.8 10.3l.9-.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* User avatar + logout */}
      {session && (
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0, // @ts-expect-error no-drag
          WebkitAppRegion: 'no-drag' }}>
          <button
            style={{ ...pill(false), padding: '3px 8px', gap: 7 }}
            onClick={() => setShowUserMenu((v) => !v)}
            title={session.name}
          >
            {session.avatar ? (
              <img src={session.avatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#3CB043', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', flexShrink: 0 }}>
                {session.name[0]?.toUpperCase()}
              </span>
            )}
            <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{session.name.split(' ')[0]}</span>
          </button>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 999,
              background: 'rgba(240,241,245,0.97)', backdropFilter: 'blur(20px)',
              borderRadius: 10, minWidth: 140,
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 32px rgba(0,0,0,0.14)',
              border: '1px solid rgba(255,255,255,0.5)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1c20', fontFamily: '-apple-system, sans-serif' }}>{session.name}</div>
              </div>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#d44', fontFamily: '-apple-system, sans-serif', textAlign: 'left' as const }}
                onClick={() => { setShowUserMenu(false); onLogout?.(); }}
              >
                Sair
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes tbPulse {
          0%,100%{opacity:.4;transform:scale(1)}
          50%{opacity:1;transform:scale(1.3)}
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 44,
    padding: isMac ? '0 14px 0 80px' : '0 14px',
    background: 'rgba(220,223,229,0.85)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderBottom: '1px solid rgba(255,255,255,0.55)',
    flexShrink: 0,
    gap: 6,
    // @ts-expect-error electron drag
    WebkitAppRegion: 'drag',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  logoBox: {
    width: 26,
    height: 26,
    background: 'rgba(255,255,255,0.72)',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 3px 8px rgba(0,0,0,0.12)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    cursor: 'pointer',
    // @ts-expect-error electron no-drag
    WebkitAppRegion: 'no-drag',
  },
  projectPath: {
    fontSize: 12,
    color: '#72757f',
    fontFamily: "'JetBrains Mono', monospace",
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    flexShrink: 0,
    // @ts-expect-error electron no-drag
    WebkitAppRegion: 'no-drag',
  },
  projectName: {
    color: '#3a3d45',
    fontWeight: 400,
  },
  modDot: {
    color: '#3CB043',
    fontSize: 10,
    marginLeft: 4,
  },
  dropMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 999,
    background: 'rgba(240,241,245,0.97)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 10,
    minWidth: 160,
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 32px rgba(0,0,0,0.14)',
    border: '1px solid rgba(255,255,255,0.5)',
    overflow: 'hidden',
    // @ts-expect-error electron no-drag
    WebkitAppRegion: 'no-drag',
  },
  dropItem: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    width: '100%',
    padding: '9px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    color: '#3a3d45',
    fontFamily: '-apple-system, sans-serif',
    textAlign: 'left' as const,
    transition: 'background .1s',
    // @ts-expect-error electron no-drag
    WebkitAppRegion: 'no-drag',
  },
};
