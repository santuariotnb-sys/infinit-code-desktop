import React, { useState, useEffect, useRef, useCallback } from 'react';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT: Record<ViewportSize, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

const SERVER_REGEXES = [
  // Genérico: localhost:PORT em qualquer formato
  /(?:localhost|127\.0\.0\.1|\[::1\]):(\d{4,5})/,
  // Vite / Next.js / CRA: "Local: http://localhost:5173"
  /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i,
  // Astro: "http://localhost:4321/"
  /https?:\/\/localhost:(\d{4,5})/i,
  // Fastify: "Server listening at http://..."
  /Server listening at.*?:(\d{4,5})/i,
  // Remix / Nuxt / Analog: "started at http://localhost:PORT"
  /started at.*?:(\d{4,5})/i,
  // ready on / ready started server on
  /ready (?:on|started server on).*?:(\d{4,5})/i,
  // listening on port / running on port
  /(?:started|listening|running|available|serving).*?port[:\s]+(\d{4,5})/i,
  // "on port 3000"
  /\bon port[:\s]+(\d{4,5})/i,
  // "PORT → " ou "PORT ->"
  /:\s*(\d{4,5})\s*(?:→|->|\()/,
  // "App running at http://..."
  /App running at.*?:(\d{4,5})/i,
  // "Network: http://..."
  /Network:.*?:(\d{4,5})/i,
  // Django / Flask / Uvicorn: "Uvicorn running on http://0.0.0.0:8000"
  /running on https?:\/\/[^:]+:(\d{4,5})/i,
  // Laravel: "Development Server started: http://localhost:8000"
  /Development Server started.*?:(\d{4,5})/i,
  // NestJS: "Nest application successfully started +Xms"
  /application successfully started.*?:(\d{4,5})/i,
  // Generic "port XXXX" fallback
  /\bport\s+(\d{4,5})\b/i,
];

const HMR_REGEXES = [/HMR/, /Fast Refresh/, /reloaded/i, /hot update/i];
const ERROR_REGEXES = [/Error:/i, /EADDRINUSE/, /Cannot find module/i, /SyntaxError/i];

interface PreviewProps {
  terminalOutput?: string;
  onRunDev?: () => void;
}

export default function Preview({ terminalOutput = '', onRunDev }: PreviewProps) {
  const [port, setPort] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [iframeKey, setIframeKey] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [hmrFlash, setHmrFlash] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [manualPort, setManualPort] = useState('');
  const [showPortInput, setShowPortInput] = useState(false);
  const [iframeRetries, setIframeRetries] = useState(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedPortRef = useRef<number | null>(null);

  // Auto-probe portas comuns se nenhuma for detectada em 8s após output
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
        } catch { /* porta não responde, continua */ }
      }
    }, 8000);
  }

  // Detect server from terminal output
  useEffect(() => {
    if (!terminalOutput) return;
    // Checa as últimas 100 linhas (era 30 — aumentado para não perder logs antigos)
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

    // Agenda auto-probe se output chegou mas porta ainda não detectada
    if (!detectedPortRef.current) scheduleProbe();

    // Check for errors
    if (ERROR_REGEXES.some((r) => r.test(recent))) {
      setServerError(true);
    } else {
      setServerError(false);
    }

    // HMR detection
    if (detectedPortRef.current && HMR_REGEXES.some((r) => r.test(recent))) {
      setIframeKey((k) => k + 1);
      setHmrFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setHmrFlash(false), 800);
    }
  }, [terminalOutput]);

  function handleLoad() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setIframeRetries(0);
    setStatus('live');
    setServerError(false);
  }

  function handleIframeError() {
    // Servidor pode ainda estar subindo — tenta até 5x com backoff antes de mostrar erro
    setIframeRetries((r) => {
      const next = r + 1;
      if (next >= 5) {
        setStatus('error');
        setServerError(true);
        return next;
      }
      const delay = Math.min(1000 * next, 4000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        setIframeKey((k) => k + 1);
      }, delay);
      return next;
    });
  }

  function handleRefresh() {
    setIframeRetries(0);
    setIframeKey((k) => k + 1);
  }

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (probeTimer.current) clearTimeout(probeTimer.current);
    };
  }, []);

  function openInBrowser() {
    if (port) window.api.shell.openExternal(`http://localhost:${port}`);
  }

  const setViewportSize = useCallback((v: ViewportSize) => setViewport(v), []);

  function handleManualPort() {
    const p = parseInt(manualPort, 10);
    if (p >= 1024 && p <= 65535) {
      detectedPortRef.current = p;
      if (probeTimer.current) clearTimeout(probeTimer.current);
      setPort(p);
      setStatus('loading');
      setServerError(false);
      setIframeRetries(0);
      setShowPortInput(false);
      setManualPort('');
    }
  }

  if (status === 'idle' || !port) {
    return (
      <div style={styles.container}>
        <div style={styles.idleState}>
          <div style={styles.idleIcon}>⬡</div>
          <p style={styles.idleTitle}>Preview ao Vivo</p>
          <p style={styles.idleText}>
            Aparece automaticamente quando o servidor iniciar
          </p>
          {onRunDev && (
            <button style={styles.runDevBtn} onClick={onRunDev}>
              ▶ npm run dev
            </button>
          )}
          {showPortInput ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                autoFocus
                type="number"
                placeholder="3000"
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualPort()}
                style={styles.portInput}
              />
              <button style={styles.runDevBtn} onClick={handleManualPort}>→</button>
            </div>
          ) : (
            <button style={{ ...styles.runDevBtn, marginTop: 4, opacity: 0.5, fontSize: 11 }} onClick={() => setShowPortInput(true)}>
              porta manual
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Status bar */}
      <div style={{ ...styles.statusBar, borderBottom: `1px solid ${hmrFlash ? '#00ff88' : '#2a2a2a'}`, transition: 'border-color 0.3s' }}>
        <span style={{ ...styles.liveDot, background: status === 'live' ? '#00ff88' : '#ffaa00' }} />
        <span style={styles.liveLabel}>{status === 'live' ? 'LIVE' : 'CONNECTING'}</span>
        <span
          style={{ ...styles.portLabel, cursor: 'pointer' }}
          title="Clique para alterar a porta"
          onClick={() => setShowPortInput((v) => !v)}
        >
          localhost:{port}
        </span>
        <div style={styles.viewportBtns}>
          {(['mobile', 'tablet', 'desktop'] as ViewportSize[]).map((v) => (
            <button
              key={v}
              style={{ ...styles.vpBtn, ...(viewport === v ? styles.vpBtnActive : {}) }}
              onClick={() => setViewportSize(v)}
              title={`${v} (${VIEWPORT[v]})`}
            >
              {v === 'mobile' ? '📱' : v === 'tablet' ? '⬜' : '🖥'}
            </button>
          ))}
        </div>
        <button style={styles.iconBtn} onClick={handleRefresh} title="Atualizar">⟳</button>
        <button style={styles.iconBtn} onClick={openInBrowser} title="Abrir no browser">↗</button>
      </div>

      {/* Port override inline */}
      {showPortInput && (
        <div style={{ display: 'flex', gap: 6, padding: '5px 10px', background: '#111', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
          <input
            autoFocus
            type="number"
            placeholder="porta (ex: 3001)"
            value={manualPort}
            onChange={(e) => setManualPort(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleManualPort(); if (e.key === 'Escape') setShowPortInput(false); }}
            style={styles.portInput}
          />
          <button style={{ ...styles.iconBtn, color: '#00ff88' }} onClick={handleManualPort}>→</button>
        </div>
      )}

      {/* Error banner */}
      {serverError && (
        <div style={styles.errorBanner}>
          ⚠ Erro no servidor — ver terminal
        </div>
      )}

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div style={styles.skeleton}>
          <div style={styles.skeletonBar} />
          <div style={{ ...styles.skeletonBar, width: '60%', marginTop: 12 }} />
          <div style={{ ...styles.skeletonBar, width: '80%', marginTop: 8 }} />
        </div>
      )}

      {/* iframe wrapper for viewport sizing */}
      <div style={{ ...styles.iframeWrapper, display: status === 'loading' ? 'none' : 'flex' }}>
        <iframe
          key={iframeKey}
          src={`http://localhost:${port}`}
          style={{ ...styles.iframe, width: VIEWPORT[viewport], maxWidth: '100%' }}
          title="Preview"
          onLoad={handleLoad}
          onError={handleIframeError}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    overflow: 'hidden',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 10px',
    background: '#111',
    flexShrink: 0,
    fontSize: '11px',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  liveLabel: {
    color: '#00ff88',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '0.05em',
  },
  portLabel: {
    color: '#666',
    fontFamily: 'monospace',
    flex: 1,
  },
  viewportBtns: {
    display: 'flex',
    gap: '2px',
  },
  vpBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '2px 4px',
    borderRadius: '3px',
    opacity: 0.4,
  },
  vpBtnActive: {
    opacity: 1,
    background: 'rgba(0,255,136,0.1)',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 5px',
    borderRadius: '3px',
  },
  errorBanner: {
    background: 'rgba(255,60,60,0.15)',
    borderBottom: '1px solid rgba(255,60,60,0.3)',
    color: '#ff6060',
    fontSize: '11px',
    padding: '5px 12px',
    flexShrink: 0,
  },
  skeleton: {
    flex: 1,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  skeletonBar: {
    height: 14,
    borderRadius: 6,
    background: 'linear-gradient(90deg, #1a1a1a 25%, #222 50%, #1a1a1a 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    width: '100%',
  },
  iframeWrapper: {
    flex: 1,
    overflow: 'auto',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  iframe: {
    height: '100%',
    border: 'none',
    background: '#fff',
    flexShrink: 0,
  },
  idleState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  idleIcon: {
    fontSize: 48,
    color: '#2a2a2a',
    lineHeight: 1,
  },
  idleTitle: {
    color: '#555',
    fontSize: 14,
    fontWeight: 600,
  },
  idleText: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 200,
  },
  portInput: {
    background: '#0d0d0d',
    border: '1px solid #2a2a2a',
    borderRadius: 4,
    color: '#fff',
    fontSize: 11,
    padding: '3px 8px',
    fontFamily: 'monospace',
    width: 100,
    outline: 'none',
  },
  runDevBtn: {
    marginTop: 8,
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#00ff88',
    padding: '7px 16px',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
};
