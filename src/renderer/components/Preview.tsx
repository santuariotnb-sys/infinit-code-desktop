import React, { useState, useEffect, useRef, useCallback } from 'react';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_WIDTH: Record<ViewportSize, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

const SERVER_REGEXES = [
  /(?:localhost|127\.0\.0\.1|\[::1\]):(\d{4,5})/,
  /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i,
  /https?:\/\/localhost:(\d{4,5})/i,
  /Server listening at.*?:(\d{4,5})/i,
  /started at.*?:(\d{4,5})/i,
  /ready (?:on|started server on).*?:(\d{4,5})/i,
  /(?:started|listening|running|available|serving).*?port[:\s]+(\d{4,5})/i,
  /\bon port[:\s]+(\d{4,5})/i,
  /:\s*(\d{4,5})\s*(?:→|->|\()/,
  /App running at.*?:(\d{4,5})/i,
  /Network:.*?:(\d{4,5})/i,
  /running on https?:\/\/[^:]+:(\d{4,5})/i,
  /Development Server started.*?:(\d{4,5})/i,
  /application successfully started.*?:(\d{4,5})/i,
  /\bport\s+(\d{4,5})\b/i,
];

// HMR puro → Vite atualiza via WebSocket, não precisa de ação
const HMR_REGEXES = [/HMR/, /Fast Refresh/, /hot update/i];
// Full reload sinalizado → reload suave sem recriar iframe
const FULL_RELOAD_REGEXES = [/\breloaded\b/i, /\bfull[- ]reload\b/i];
const ERROR_REGEXES = [/EADDRINUSE/, /Cannot find module/i, /SyntaxError:/i];

// Arquivos candidatos a conter rotas
const ROUTER_CANDIDATES = [
  'src/App.tsx', 'src/App.jsx', 'src/app.tsx', 'src/app.jsx',
  'src/router.tsx', 'src/router.jsx', 'src/routes.tsx', 'src/routes.jsx',
  'src/router/index.tsx', 'src/router/index.jsx',
  'app/routes.ts', 'app/routes.tsx',
];

function extractRoutes(content: string): string[] {
  const paths = new Set<string>();

  // path="..." ou path={'...'} (JSX)
  for (const m of content.matchAll(/path=["'`]([^"'`]+)["'`]/g)) {
    const p = m[1].trim();
    if (p && p.startsWith('/')) paths.add(p);
  }

  // { path: "..." } (createBrowserRouter / createHashRouter)
  for (const m of content.matchAll(/path:\s*["'`]([^"'`]+)["'`]/g)) {
    const p = m[1].trim();
    if (p && p.startsWith('/')) paths.add(p);
  }

  // Ordena: "/" primeiro, depois alfabético
  const sorted = Array.from(paths).sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });

  return sorted;
}

// SVG icons
function IconMobile() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}
function IconTablet() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}
function IconDesktop() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface PreviewProps {
  terminalOutput?: string;
  onRunDev?: () => void;
  projectPath?: string | null;
  hasNodeModules?: boolean | null;
  pkgManager?: string;
}

export default function Preview({ terminalOutput = '', onRunDev, projectPath, hasNodeModules, pkgManager = 'npm' }: PreviewProps) {
  const [port, setPort] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [iframeKey, setIframeKey] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [hmrFlash, setHmrFlash] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [editingPath, setEditingPath] = useState(false);
  const [draftPath, setDraftPath] = useState('/');
  const [iframeRetries, setIframeRetries] = useState(0);

  // Rotas detectadas do router do projeto
  const [routes, setRoutes] = useState<string[]>([]);
  const [showRoutesPicker, setShowRoutesPicker] = useState(false);
  const routesPickerRef = useRef<HTMLDivElement>(null);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedPortRef = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Rastreia por path (não boolean) para evitar race condition entre effects
  const autoStartedForRef = useRef<string | null>(null);
  const autoInstalledForRef = useRef<string | null>(null);

  // ── Detecta rotas do arquivo de roteamento do projeto ──
  const detectRoutes = useCallback(async () => {
    if (!projectPath) return;
    for (const rel of ROUTER_CANDIDATES) {
      const result = await window.api.files.read(`${projectPath}/${rel}`);
      if (!result?.ok || !result.data) continue;
      const found = extractRoutes(result.data);
      if (found.length > 0) {
        setRoutes(found);
        return;
      }
    }
    setRoutes([]);
  }, [projectPath]);

  // Atualiza rotas quando projeto muda ou arquivo de roteamento muda
  useEffect(() => {
    detectRoutes();
  }, [detectRoutes]);

  // Escuta mudanças de arquivo — re-detecta rotas se for o arquivo de router
  useEffect(() => {
    if (!projectPath) return;
    const cleanup = window.api.files.onChanged((changedPath: string) => {
      const rel = changedPath.replace(projectPath + '/', '');
      if (ROUTER_CANDIDATES.includes(rel)) {
        detectRoutes();
      }
    });
    return cleanup;
  }, [projectPath, detectRoutes]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!showRoutesPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (routesPickerRef.current && !routesPickerRef.current.contains(e.target as Node)) {
        setShowRoutesPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoutesPicker]);

  // Reset ao trocar de projeto — sempre primeiro
  useEffect(() => {
    if (!projectPath) return;
    autoStartedForRef.current = null;
    autoInstalledForRef.current = null;
    detectedPortRef.current = null;
    setPort(null);
    setStatus('idle');
    setCurrentPath('/');
    setDraftPath('/');
    setServerError(false);
    setIframeRetries(0);
    setRoutes([]);
    setShowRoutesPicker(false);
  }, [projectPath]);

  // Auto-install quando faltam node_modules
  useEffect(() => {
    if (!projectPath || hasNodeModules !== false) return;
    if (autoInstalledForRef.current === projectPath) return;
    autoInstalledForRef.current = projectPath;
    const cmd =
      pkgManager === 'bun' ? 'bun install' :
      pkgManager === 'pnpm' ? 'pnpm install' :
      pkgManager === 'yarn' ? 'yarn' : 'npm install';
    setTimeout(() => window.api.terminal.write(cmd + '\r'), 800);
  }, [projectPath, hasNodeModules, pkgManager]);

  // Auto-start dev server quando node_modules está disponível
  useEffect(() => {
    if (!projectPath || !onRunDev || hasNodeModules !== true) return;
    if (autoStartedForRef.current === projectPath) return;
    autoStartedForRef.current = projectPath;
    setTimeout(() => onRunDev(), 600);
  }, [projectPath, hasNodeModules, onRunDev]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (probeTimer.current) clearTimeout(probeTimer.current);
    };
  }, []);

  // Auto-probe portas comuns se nenhuma detectada em 8s
  function scheduleProbe() {
    if (probeTimer.current) clearTimeout(probeTimer.current);
    probeTimer.current = setTimeout(async () => {
      if (detectedPortRef.current) return;
      const candidates = [3000, 5173, 8080, 4321, 8000, 3001, 4000, 8888];
      for (const p of candidates) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 600);
          const res = await fetch(`http://localhost:${p}`, { signal: ctrl.signal, mode: 'no-cors' });
          clearTimeout(t);
          if (res.type === 'opaque' || res.ok) {
            detectedPortRef.current = p;
            setPort(p);
            setStatus('loading');
            setServerError(false);
            break;
          }
        } catch { /* porta não responde */ }
      }
    }, 8000);
  }

  // Detecção de porta via terminal output
  useEffect(() => {
    if (!terminalOutput) return;
    const lines = terminalOutput.split('\n').slice(-100);

    for (const line of lines) {
      for (const re of SERVER_REGEXES) {
        const m = line.match(re);
        if (m) {
          const detected = parseInt(m[1], 10);
          if (detected >= 1024 && detected <= 65535 && detected !== detectedPortRef.current) {
            detectedPortRef.current = detected;
            if (probeTimer.current) clearTimeout(probeTimer.current);
            setPort(detected);
            setStatus('loading');
            setServerError(false);
            setIframeRetries(0);
          }
          break;
        }
      }
    }

    const recent = lines.join('\n');
    if (!detectedPortRef.current) scheduleProbe();

    if (ERROR_REGEXES.some(r => r.test(recent))) {
      setServerError(true);
    } else if (detectedPortRef.current) {
      setServerError(false);
    }

    if (detectedPortRef.current) {
      // HMR puro → só flash visual, Vite já atualizou via WebSocket
      if (HMR_REGEXES.some(r => r.test(recent))) {
        setHmrFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setHmrFlash(false), 600);
      }
      // Full reload sinalizado → reload suave sem recriar iframe
      if (FULL_RELOAD_REGEXES.some(r => r.test(recent))) {
        try {
          iframeRef.current?.contentWindow?.location.reload();
        } catch {
          // Cross-origin fallback: recria iframe
          setIframeKey(k => k + 1);
        }
        setHmrFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setHmrFlash(false), 600);
      }
    }
  }, [terminalOutput]);

  function handleLoad() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setIframeRetries(0);
    setStatus('live');
    setServerError(false);
    try {
      const path = iframeRef.current?.contentWindow?.location?.pathname ?? '/';
      setCurrentPath(path);
      setDraftPath(path);
    } catch { /* cross-origin */ }
  }

  function handleIframeError() {
    setIframeRetries(r => {
      const next = r + 1;
      if (next >= 5) {
        setStatus('error');
        setServerError(true);
        return next;
      }
      const delay = Math.min(1000 * next, 4000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => setIframeKey(k => k + 1), delay);
      return next;
    });
  }

  function navigateTo(path: string) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    setCurrentPath(normalized);
    setDraftPath(normalized);
    setEditingPath(false);
    setShowRoutesPicker(false);
    setIframeKey(k => k + 1);
  }

  function handleRefresh() {
    setIframeRetries(0);
    setIframeKey(k => k + 1);
  }

  function openExternal() {
    if (port) window.api.shell.openExternal(`http://localhost:${port}${currentPath}`);
  }

  const isLive = status === 'live';
  const isConnecting = status === 'loading';
  const dotColor = !port ? '#333' : isLive ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444';
  const src = port ? `http://localhost:${port}${currentPath}` : '';

  return (
    <div style={s.root}>
      {/* ── Browser toolbar ── */}
      <div style={{ ...s.toolbar, borderBottomColor: hmrFlash ? '#22c55e' : '#1e1e1e' }}>

        {/* Status dot */}
        <div style={{ ...s.dot, background: dotColor }} title={!port ? 'Aguardando servidor' : status} />

        {/* Address bar com dropdown de rotas */}
        <div style={s.addressAreaWrap} ref={routesPickerRef}>
          <div
            style={{ ...s.addressBar, borderColor: editingPath ? 'rgba(255,255,255,0.15)' : 'transparent' }}
            onClick={() => { if (!editingPath) { setEditingPath(true); setDraftPath(currentPath); setShowRoutesPicker(false); } }}
          >
            {editingPath ? (
              <input
                autoFocus
                style={s.addressInput}
                value={draftPath}
                onChange={e => setDraftPath(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigateTo(draftPath);
                  if (e.key === 'Escape') setEditingPath(false);
                }}
                onBlur={() => setEditingPath(false)}
              />
            ) : port ? (
              <span style={s.addressText}>
                <span style={s.addressHost}>localhost:{port}</span>
                <span style={s.addressPath}>{currentPath}</span>
              </span>
            ) : (
              <span style={s.addressPlaceholder}>Aguardando servidor…</span>
            )}
          </div>

          {/* Botão de rotas — só aparece se detectou rotas */}
          {routes.length > 0 && (
            <button
              style={{ ...s.routesBtn, background: showRoutesPicker ? 'rgba(255,255,255,0.06)' : 'transparent' }}
              onClick={() => { setShowRoutesPicker(v => !v); setEditingPath(false); }}
              title="Páginas detectadas"
            >
              <IconChevron />
            </button>
          )}

          {/* Dropdown de rotas */}
          {showRoutesPicker && routes.length > 0 && (
            <div style={s.routesDropdown}>
              {routes.map(route => (
                <button
                  key={route}
                  style={{
                    ...s.routeItem,
                    background: currentPath === route ? 'rgba(34,197,94,0.08)' : 'transparent',
                    color: currentPath === route ? '#22c55e' : '#ccc',
                  }}
                  onClick={() => navigateTo(route)}
                >
                  <span style={s.routeItemText}>{route}</span>
                  {currentPath === route && <span style={s.routeCheck}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <button style={{ ...s.iconBtn, opacity: port ? 0.7 : 0.25 }} onClick={openExternal} disabled={!port} title="Abrir no browser">
          <IconExternal />
        </button>
        <button style={{ ...s.iconBtn, opacity: port ? 0.7 : 0.25 }} onClick={handleRefresh} disabled={!port} title="Recarregar">
          <IconRefresh />
        </button>

        <div style={s.sep} />

        {/* Viewport */}
        {(['mobile', 'tablet', 'desktop'] as ViewportSize[]).map(v => (
          <button
            key={v}
            style={{ ...s.vpBtn, color: viewport === v ? '#22c55e' : '#555', background: viewport === v ? 'rgba(34,197,94,0.08)' : 'transparent' }}
            onClick={() => setViewport(v)}
            title={`${v} — ${VIEWPORT_WIDTH[v]}`}
          >
            {v === 'mobile' ? <IconMobile /> : v === 'tablet' ? <IconTablet /> : <IconDesktop />}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {serverError && (
        <div style={s.errorBanner}>⚠ Erro no servidor — ver terminal</div>
      )}

      {/* ── Content ── */}
      {!port ? (
        <div style={s.idle}>
          <div style={s.idleIcon}><IconDesktop /></div>

          {!projectPath && (
            <>
              <p style={s.idleTitle}>Preview ao Vivo</p>
              <p style={s.idleSubtitle}>Abra um projeto para começar</p>
            </>
          )}

          {projectPath && hasNodeModules === null && (
            <>
              <p style={s.idleTitle}>Verificando projeto…</p>
              <div style={s.spinner} />
            </>
          )}

          {projectPath && hasNodeModules === false && (
            <>
              <p style={s.idleTitle}>Instalando dependências</p>
              <p style={s.idleSubtitle}>Rodando <code style={s.code}>{pkgManager === 'bun' ? 'bun install' : pkgManager === 'pnpm' ? 'pnpm install' : pkgManager === 'yarn' ? 'yarn' : 'npm install'}</code> no terminal…</p>
              <div style={s.spinner} />
              <button style={s.runBtnSecondary} onClick={() => {
                const cmd = pkgManager === 'bun' ? 'bun install' : pkgManager === 'pnpm' ? 'pnpm install' : pkgManager === 'yarn' ? 'yarn' : 'npm install';
                window.api.terminal.write(cmd + '\r');
              }}>↺ Reinstalar</button>
            </>
          )}

          {projectPath && hasNodeModules === true && (
            <>
              <p style={s.idleTitle}>Iniciando servidor…</p>
              <p style={s.idleSubtitle}>Aguardando <code style={s.code}>{pkgManager} run dev</code></p>
              <div style={s.spinner} />
              <button style={s.runBtnSecondary} onClick={onRunDev}>▶ Iniciar manualmente</button>
            </>
          )}
        </div>
      ) : (
        <div style={s.content}>
          {status === 'loading' && (
            <div style={s.skeleton}>
              <div style={s.skBar} />
              <div style={{ ...s.skBar, width: '65%', marginTop: 10 }} />
              <div style={{ ...s.skBar, width: '80%', marginTop: 8 }} />
            </div>
          )}
          <div style={{ ...s.iframeWrap, display: status === 'loading' ? 'none' : 'flex', justifyContent: 'center' }}>
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={src}
              style={{ ...s.iframe, width: VIEWPORT_WIDTH[viewport] }}
              title="Preview"
              onLoad={handleLoad}
              onError={handleIframeError}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d0d',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 8px',
    height: 36,
    background: '#111',
    borderBottom: '1px solid #1e1e1e',
    flexShrink: 0,
    transition: 'border-color 0.3s',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s',
  },
  addressAreaWrap: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  addressBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '0 8px',
    height: 24,
    cursor: 'text',
    transition: 'border-color 0.15s',
    overflow: 'hidden',
    minWidth: 0,
  },
  addressInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ccc',
    fontSize: 11,
    fontFamily: 'monospace',
    width: '100%',
  },
  addressText: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    fontSize: 11,
    fontFamily: 'monospace',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  addressHost: {
    color: '#444',
  },
  addressPath: {
    color: '#aaa',
  },
  addressPlaceholder: {
    color: '#333',
    fontSize: 11,
  },
  routesBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    color: '#555',
    cursor: 'pointer',
    padding: '4px 5px',
    borderRadius: 4,
    flexShrink: 0,
    transition: 'background 0.15s, color 0.15s',
  },
  routesDropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    maxHeight: 260,
    overflowY: 'auto',
  },
  routeItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    padding: '7px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  routeItemText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  routeCheck: {
    color: '#22c55e',
    fontSize: 11,
    marginLeft: 8,
    flexShrink: 0,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px 5px',
    borderRadius: 4,
    transition: 'color 0.15s, background 0.15s',
    flexShrink: 0,
  },
  sep: {
    width: 1,
    height: 16,
    background: '#222',
    flexShrink: 0,
    margin: '0 2px',
  },
  vpBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 5px',
    borderRadius: 4,
    transition: 'color 0.15s, background 0.15s',
    flexShrink: 0,
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.12)',
    borderBottom: '1px solid rgba(239,68,68,0.25)',
    color: '#f87171',
    fontSize: 11,
    padding: '4px 12px',
    flexShrink: 0,
  },
  idle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  idleIcon: {
    color: '#3a3a3a',
    fontSize: 48,
    marginBottom: 4,
  },
  idleTitle: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: 600,
    margin: 0,
    textAlign: 'center' as const,
  },
  idleSubtitle: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center' as const,
    lineHeight: 1.6,
    maxWidth: 240,
    margin: 0,
  },
  code: {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    padding: '1px 5px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#22c55e',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid #2a2a2a',
    borderTop: '2px solid #22c55e',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  runBtnSecondary: {
    marginTop: 2,
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#555',
    padding: '5px 14px',
    borderRadius: 6,
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  skeleton: {
    flex: 1,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  skBar: {
    height: 12,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #161616 25%, #1e1e1e 50%, #161616 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    width: '100%',
  },
  iframeWrap: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    overflow: 'hidden',
    background: '#0d0d0d',
    minHeight: 0,
  },
  iframe: {
    height: '100%',
    border: 'none',
    background: '#fff',
    flexShrink: 0,
  },
};
