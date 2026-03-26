import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SERVER_REGEXES } from '../lib/portDetect';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_WIDTH: Record<ViewportSize, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

// HMR puro → Vite atualiza via WebSocket, não precisa de ação
const HMR_REGEXES = [/HMR/, /Fast Refresh/, /hot update/i];
// Full reload sinalizado → reload suave sem recriar iframe
const FULL_RELOAD_REGEXES = [/\breloaded\b/i, /\bfull[- ]reload\b/i];
const ERROR_REGEXES = [/EADDRINUSE/, /Cannot find module/i, /SyntaxError:/i];

// Extrai todas as rotas de um arquivo
function extractRoutes(content: string): string[] {
  const paths = new Set<string>();
  const ROUTE_PATTERNS = [
    /path=["'`{]\s*["'`]([^"'`]+)["'`]/g,           // path="/foo"
    /path:\s*["'`]([^"'`]+)["'`]/g,                   // path: "/foo"
    /to=["'`{]\s*["'`]([^"'`]+)["'`]/g,              // to="/foo"
    /href=["'`]([^"'`]+)["'`]/g,                       // href="/foo"
    /(?:navigate|push|replace)\(\s*["'`]([^"'`]+)["'`]/g, // navigate("/foo")
    /element:\s*["'`]([^"'`]+)["'`]/g,                // element: "/foo" (raro)
  ];
  for (const re of ROUTE_PATTERNS) {
    for (const m of content.matchAll(re)) {
      const p = m[1].trim();
      if (p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/cdn') && !p.includes('.') && p.length < 80) {
        paths.add(p);
      }
    }
  }
  return Array.from(paths);
}

// Escaneia diretório recursivamente e retorna todos os .tsx/.jsx
async function scanFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  try {
    const result = await window.api.files.readDir(dir);
    if (!result?.ok || !result.data) return [];
    const paths: string[] = [];
    const subDirs: Promise<string[]>[] = [];
    for (const f of result.data) {
      if (f.type === 'folder' && !f.name.startsWith('.') && f.name !== 'node_modules' && f.name !== 'dist' && f.name !== 'build' && f.name !== '.next') {
        subDirs.push(scanFiles(f.path, depth + 1));
      } else if (f.type === 'file' && /\.(tsx|jsx|ts|js)$/.test(f.name) && !/\.(test|spec|stories)\./i.test(f.name)) {
        paths.push(f.path);
      }
    }
    const nested = await Promise.allSettled(subDirs);
    for (const r of nested) {
      if (r.status === 'fulfilled') paths.push(...r.value);
    }
    return paths;
  } catch { return []; }
}

// Converte nome de arquivo de página em rota (file-based routing)
function fileToRoute(filePath: string, pagesDir: string): string | null {
  let rel = filePath.replace(pagesDir, '').replace(/\\/g, '/');
  // Remove extensão
  rel = rel.replace(/\.(tsx|jsx|ts|js)$/, '');
  // Remove /index
  rel = rel.replace(/\/index$/, '') || '/';
  // Remove _app, _document, _error (Next.js internals)
  if (/\/_/.test(rel)) return null;
  // Converte [param] → :param
  rel = rel.replace(/\[([^\]]+)\]/g, ':$1');
  return rel.startsWith('/') ? rel : `/${rel}`;
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
  refreshTrigger?: number; // incrementar para forçar reload (ex: pós-git-sync)
  onPathChange?: (path: string, port: number | null) => void;
  /** Porta já detectada pelo terminal ghost — se definida, servidor já está rodando */
  serverPort?: number | null;
}

export default function Preview({ terminalOutput = '', onRunDev, projectPath, hasNodeModules, pkgManager = 'npm', refreshTrigger, onPathChange, serverPort }: PreviewProps) {
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

  // ── Histórico de navegação (back/forward) ────────────────
  const [navHistory, setNavHistory] = useState<string[]>(['/']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const canGoBack = historyIdx > 0;
  const canGoForward = historyIdx < navHistory.length - 1;

  // ── Menu de contexto ─────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Rotas detectadas do router do projeto
  const [routes, setRoutes] = useState<string[]>([]);
  const [showRoutesPicker, setShowRoutesPicker] = useState(false);
  const routesPickerRef = useRef<HTMLDivElement>(null);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedPortRef = useRef<number | null>(null);

  // Usa serverPort da ghost terminal imediatamente quando disponível
  // Roda com pequeno delay para garantir que o reset de projeto já executou
  useEffect(() => {
    if (!serverPort) return;
    const t = setTimeout(() => {
      detectedPortRef.current = serverPort;
      if (probeTimer.current) clearTimeout(probeTimer.current);
      setPort(serverPort);
      setStatus('loading');
      setServerError(false);
      setIframeRetries(0);
    }, 50);
    return () => clearTimeout(t);
  }, [serverPort]);

  // Ref estável para onPathChange — evita loop infinito com função inline
  const onPathChangeRef = useRef(onPathChange);
  useEffect(() => { onPathChangeRef.current = onPathChange; });

  // Ref estável para onRunDev — evita disparar effect de auto-start quando IDE re-renderiza
  const onRunDevRef = useRef(onRunDev);
  useEffect(() => { onRunDevRef.current = onRunDev; });

  // Notifica IDE quando rota ou porta muda (sem incluir a callback na dep array)
  useEffect(() => {
    onPathChangeRef.current?.(currentPath, port);
  }, [currentPath, port]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Rastreia por path (não boolean) para evitar race condition entre effects
  const autoStartedForRef = useRef<string | null>(null);
  const autoInstalledForRef = useRef<string | null>(null);

  // ── Detecta rotas do arquivo de roteamento do projeto ──
  const detectRoutes = useCallback(async () => {
    if (!projectPath) return;
    const allRoutes = new Set<string>();

    // 1. Deep scan: lê todos .tsx/.jsx em src/ e app/
    const allFiles = [
      ...(await scanFiles(`${projectPath}/src`)),
      ...(await scanFiles(`${projectPath}/app`)),
    ];
    const filesToRead = allFiles.slice(0, 50);
    const reads = await Promise.allSettled(
      filesToRead.map(f => window.api.files.read(f))
    );
    for (const r of reads) {
      if (r.status !== 'fulfilled' || !r.value?.ok || !r.value.data) continue;
      for (const route of extractRoutes(r.value.data)) {
        allRoutes.add(route);
      }
    }

    // 2. File-based routing: src/pages/ e pages/
    for (const dir of [`${projectPath}/src/pages`, `${projectPath}/pages`]) {
      for (const f of await scanFiles(dir, 0)) {
        const route = fileToRoute(f, dir);
        if (route) allRoutes.add(route);
      }
    }

    // 3. Fallback: scanRoutes do main process (se disponível)
    if (allRoutes.size === 0) {
      try {
        const res = await window.api.files.scanRoutes(projectPath);
        if (res.ok && res.routes.length > 0) {
          for (const r of res.routes) allRoutes.add(r.route);
        }
      } catch { /* scanRoutes não disponível */ }
    }

    // Remove rotas com parâmetros dinâmicos e wildcards
    const clean = Array.from(allRoutes)
      .filter(r => !r.includes(':') && !r.includes('*'))
      .sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
      });
    setRoutes(clean);
  }, [projectPath]);

  // Atualiza rotas quando projeto muda ou arquivo de roteamento muda
  useEffect(() => {
    detectRoutes();
  }, [detectRoutes]);

  // Escuta mudanças de arquivo — re-detecta rotas se for arquivo de rota
  useEffect(() => {
    if (!projectPath) return;
    const cleanup = window.api.files.onChanged((changedPath: string) => {
      if (/\.(tsx|jsx|ts|js)$/.test(changedPath) && /(?:App|route|page|layout)/i.test(changedPath)) {
        detectRoutes();
      }
    });
    return cleanup;
  }, [projectPath, detectRoutes]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showRoutesPicker && routesPickerRef.current && !routesPickerRef.current.contains(e.target as Node)) {
        setShowRoutesPicker(false);
      }
      if (ctxMenu && ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRoutesPicker, ctxMenu, showMoreMenu]);

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
    setTimeout(() => window.api.terminal.write(cmd + '\r'), 200);
  }, [projectPath, hasNodeModules, pkgManager]);

  // Auto-start dev server quando node_modules está disponível
  useEffect(() => {
    if (!projectPath || hasNodeModules !== true) return;
    if (autoStartedForRef.current === projectPath) return;
    if (serverPort) return; // servidor já está rodando — não reinicia
    autoStartedForRef.current = projectPath;
    setTimeout(() => onRunDevRef.current?.(), 150);
  }, [projectPath, hasNodeModules, serverPort]); // onRunDev removido — usa ref estável

  // Refresh externo (ex: pós-git-sync/pull) — aguarda Vite compilar antes de recarregar
  useEffect(() => {
    if (!refreshTrigger || !port) return;
    try {
      // Navega para a URL atual forçando bypass de cache (adiciona ?_r=timestamp)
      const win = iframeRef.current?.contentWindow;
      if (win) {
        const base = `http://localhost:${port}${currentPath}`;
        const url = base.includes('?') ? `${base}&_r=${Date.now()}` : `${base}?_r=${Date.now()}`;
        win.location.replace(url);
      } else {
        setIframeKey(k => k + 1);
      }
    } catch {
      setIframeKey(k => k + 1);
    }
    setHmrFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setHmrFlash(false), 1200);
  }, [refreshTrigger]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (probeTimer.current) clearTimeout(probeTimer.current);
    };
  }, []);

  // Auto-probe portas comuns se nenhuma detectada em 2s
  function scheduleProbe() {
    if (probeTimer.current) clearTimeout(probeTimer.current);
    probeTimer.current = setTimeout(async () => {
      if (detectedPortRef.current) return;
      const candidates = [3000, 5173, 8080, 4321, 8000, 3001, 4000, 8888];
      for (const p of candidates) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 400);
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
    }, 2000);
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
      const delay = Math.min(500 * next, 2000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => setIframeKey(k => k + 1), delay);
      return next;
    });
  }

  function navigateTo(path: string, pushHistory = true) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    setCurrentPath(normalized);
    setDraftPath(normalized);
    setEditingPath(false);
    setShowRoutesPicker(false);
    setIframeKey(k => k + 1);
    if (pushHistory) {
      setNavHistory(prev => {
        const trimmed = prev.slice(0, historyIdx + 1);
        return [...trimmed, normalized];
      });
      setHistoryIdx(i => i + 1);
    }
  }

  function goBack() {
    if (!canGoBack) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    const path = navHistory[newIdx];
    setCurrentPath(path);
    setDraftPath(path);
    setIframeKey(k => k + 1);
  }

  function goForward() {
    if (!canGoForward) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    const path = navHistory[newIdx];
    setCurrentPath(path);
    setDraftPath(path);
    setIframeKey(k => k + 1);
  }

  function handleRefresh() {
    setIframeRetries(0);
    setIframeKey(k => k + 1);
  }

  function openExternal() {
    if (port) window.api.shell.openExternal(`http://localhost:${port}${currentPath}`);
  }

  function copyUrl() {
    if (port) navigator.clipboard.writeText(`http://localhost:${port}${currentPath}`).catch(() => {});
  }

  async function pasteAndNavigate() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith('/')) navigateTo(text);
      else if (text.startsWith('http://localhost')) {
        const url = new URL(text);
        navigateTo(url.pathname);
      }
    } catch { /* permissão negada */ }
  }

  function printPage() {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch { window.print(); }
  }

  function downloadPage() {
    if (!port) return;
    const url = `http://localhost:${port}${currentPath}`;
    window.api.shell.openExternal(url);
  }

  function searchGoogle() {
    const query = encodeURIComponent(`site:localhost:${port ?? ''} ${currentPath}`);
    window.api.shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(currentPath.slice(1) || 'localhost')}`);
    void query; // suppress unused warning
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
    setShowMoreMenu(false);
  }

  function closeCtx() { setCtxMenu(null); }

  const isLive = status === 'live';
  const isConnecting = status === 'loading';
  const dotColor = !port ? '#333' : isLive ? '#22c55e' : isConnecting ? '#f59e0b' : '#ef4444';
  const src = port ? `http://localhost:${port}${currentPath}` : '';

  // ── Items reutilizáveis do menu de contexto/ações ────────
  function renderCtxItems(close: () => void) {
    const item = (label: string, icon: string, action: () => void, disabled = false, danger = false) => (
      <button
        key={label}
        style={{ ...s.ctxItem, opacity: disabled ? 0.3 : 1, color: danger ? '#f87171' : '#ddd', cursor: disabled ? 'default' : 'pointer' }}
        onClick={disabled ? undefined : () => { close(); action(); }}
        disabled={disabled}
      >
        <span style={s.ctxIcon}>{icon}</span>
        {label}
      </button>
    );
    const sep = (key: string) => <div key={key} style={s.ctxSep} />;

    return (
      <>
        {item('Voltar', '←', goBack, !canGoBack)}
        {item('Avançar', '→', goForward, !canGoForward)}
        {item('Recarregar', '↺', handleRefresh, !port)}
        {sep('s1')}
        {item('Copiar URL', '⎘', copyUrl, !port)}
        {item('Colar e navegar', '⎗', pasteAndNavigate, !port)}
        {sep('s2')}
        {item('Imprimir', '⎙', printPage, !port)}
        {item('Download da página', '⬇', downloadPage, !port)}
        {item('Pesquisar no Google', '🔍', searchGoogle)}
        {sep('s3')}
        {item('Abrir no browser', '🌐', openExternal, !port)}
        {sep('s4')}
        <div style={{ padding: '4px 12px 2px', fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Viewport</div>
        {(['mobile', 'tablet', 'desktop'] as ViewportSize[]).map(v =>
          item(`${v.charAt(0).toUpperCase() + v.slice(1)} (${VIEWPORT_WIDTH[v]})`,
            v === 'mobile' ? '📱' : v === 'tablet' ? '📋' : '🖥',
            () => setViewport(v), false, false
          )
        )}
      </>
    );
  }

  return (
    <div style={s.root}>
      {/* ── Browser toolbar ── */}
      <div style={{ ...s.toolbar, borderBottomColor: hmrFlash ? '#22c55e' : '#1e1e1e' }}>

        {/* Back / Forward */}
        <button style={{ ...s.iconBtn, opacity: canGoBack ? 0.8 : 0.2 }} onClick={goBack} disabled={!canGoBack} title="Voltar (Alt+←)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button style={{ ...s.iconBtn, opacity: canGoForward ? 0.8 : 0.2 }} onClick={goForward} disabled={!canGoForward} title="Avançar (Alt+→)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        {/* Status dot + badge ao vivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{ ...s.dot, background: dotColor }} title={!port ? 'Aguardando servidor' : status} />
          {isLive && (
            <span style={{ ...s.liveBadge, animation: hmrFlash ? 'none' : undefined, background: hmrFlash ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.1)' }}>
              ao vivo
            </span>
          )}
        </div>

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

          {/* Botão de rotas — sempre visível quando tem porta */}
          {port && (
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: '1px solid',
                borderColor: showRoutesPicker ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
                background: showRoutesPicker ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                color: showRoutesPicker ? '#22c55e' : '#999',
                cursor: 'pointer',
                padding: '3px 8px 3px 6px',
                borderRadius: 5,
                flexShrink: 0,
                fontSize: 10,
                fontFamily: 'monospace',
                transition: 'all 0.15s',
              }}
              onClick={() => { setShowRoutesPicker(v => !v); setEditingPath(false); }}
              onMouseEnter={(e) => { if (!showRoutesPicker) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#ccc'; } }}
              onMouseLeave={(e) => { if (!showRoutesPicker) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#999'; } }}
              title={routes.length > 0 ? `${routes.length} páginas detectadas` : 'Navegar para URL'}
            >
              <IconChevron />
              Rotas
            </button>
          )}

          {/* Dropdown de rotas */}
          {showRoutesPicker && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#fff',
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.1)',
              maxHeight: 320,
              overflowY: 'auto',
            }}>
              {/* Rota atual no topo */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderBottom: '1px solid #eee',
                background: '#f8f8f8', fontSize: 12, fontFamily: 'monospace', color: '#333',
              }}>
                <span style={{ color: '#999', fontSize: 11 }}>→</span>
                <input
                  autoFocus
                  defaultValue={currentPath}
                  placeholder="/rota"
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 12, fontFamily: 'monospace', color: '#333',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) navigateTo(val.startsWith('/') ? val : `/${val}`);
                    }
                    if (e.key === 'Escape') setShowRoutesPicker(false);
                  }}
                  onFocus={e => e.target.select()}
                />
              </div>
              {/* Lista de rotas */}
              {routes.map(route => (
                <button
                  key={route}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    padding: '8px 12px', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'monospace', textAlign: 'left',
                    background: currentPath === route ? '#e8f5e9' : '#fff',
                    color: currentPath === route ? '#2e7d32' : '#333',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (currentPath !== route) e.currentTarget.style.background = '#f5f5f5'; }}
                  onMouseLeave={e => { if (currentPath !== route) e.currentTarget.style.background = '#fff'; }}
                  onClick={() => navigateTo(route)}
                >
                  <span style={{ flex: 1 }}>{route}</span>
                  {currentPath === route && <span style={{ color: '#4caf50', fontSize: 11 }}>✓</span>}
                </button>
              ))}
              {routes.length === 0 && (
                <div style={{ padding: '14px 12px', fontSize: 12, color: '#999', textAlign: 'center', fontFamily: '-apple-system, sans-serif' }}>
                  Nenhuma página detectada.<br/>
                  <span style={{ fontSize: 11, color: '#bbb' }}>Digite uma rota acima e pressione Enter.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ações fixas */}
        <button style={{ ...s.iconBtn, opacity: port ? 0.7 : 0.25 }} onClick={openExternal} disabled={!port} title="Abrir no browser">
          <IconExternal />
        </button>
        <button style={{ ...s.iconBtn, opacity: port ? 0.7 : 0.25 }} onClick={handleRefresh} disabled={!port} title="Recarregar (F5)">
          <IconRefresh />
        </button>

        {/* Botão ⋯ — abre menu de ações (left-click) */}
        <div ref={moreMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            style={{ ...s.iconBtn, opacity: port ? 0.8 : 0.3, fontSize: 15, letterSpacing: 1 }}
            onClick={() => setShowMoreMenu(v => !v)}
            title="Mais ações"
          >
            ⋯
          </button>
          {showMoreMenu && (
            <div style={{ ...s.ctxMenuBox, position: 'absolute', top: 'calc(100% + 4px)', right: 0, maxHeight: 360, overflowY: 'auto' }} onContextMenu={e => e.preventDefault()}>
              {renderCtxItems(() => setShowMoreMenu(false))}
            </div>
          )}
        </div>

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

      {/* ── Menu de contexto flutuante (right-click) ── */}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          style={{ ...s.ctxMenuBox, position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999 }}
          onContextMenu={e => e.preventDefault()}
        >
          {renderCtxItems(closeCtx)}
        </div>
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
        <div style={s.content} onContextMenu={handleContextMenu}>
          {status === 'loading' && (
            <div style={s.skeleton}>
              <div style={s.skBar} />
              <div style={{ ...s.skBar, width: '65%', marginTop: 10 }} />
              <div style={{ ...s.skBar, width: '80%', marginTop: 8 }} />
            </div>
          )}
          <div style={{ ...s.iframeWrap, display: status === 'loading' ? 'none' : 'flex', justifyContent: 'center', position: 'relative' }}>
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={src}
              style={{ ...s.iframe, width: VIEWPORT_WIDTH[viewport] }}
              title="Preview"
              onLoad={handleLoad}
              onError={handleIframeError}
            />
            {/* Overlay transparente — captura right-click que sai do iframe */}
            <div
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              onContextMenu={handleContextMenu}
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
  liveBadge: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#22c55e',
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid rgba(34,197,94,0.2)',
    transition: 'background 0.3s',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
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

  // ── Context menu ────────────────────────────────────────
  ctxMenuBox: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 9,
    padding: '4px 0',
    minWidth: 200,
    boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset',
    zIndex: 500,
    overflow: 'hidden',
  },
  ctxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '7px 14px',
    background: 'none',
    border: 'none',
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    textAlign: 'left' as const,
    transition: 'background 0.1s',
    whiteSpace: 'nowrap' as const,
  },
  ctxIcon: {
    fontSize: 12,
    width: 18,
    textAlign: 'center' as const,
    flexShrink: 0,
    opacity: 0.8,
  },
  ctxSep: {
    height: 1,
    background: '#2a2a2a',
    margin: '3px 0',
  },
};
