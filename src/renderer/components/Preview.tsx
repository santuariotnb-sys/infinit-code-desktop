import React, { useState, useEffect, useRef, useCallback } from 'react';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT: Record<ViewportSize, string> = {
  mobile: '375px',
  tablet: '768px',
  desktop: '100%',
};

const SERVER_REGEXES = [
  /(?:localhost|127\.0\.0\.1):(\d{4,5})/,
  /ready on.*?:(\d{4,5})/i,
  /started server.*?(\d{4,5})/i,
  /listening.*?port.*?(\d{4,5})/i,
  /Local:\s+http:\/\/localhost:(\d{4,5})/i,
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect server from terminal output
  useEffect(() => {
    if (!terminalOutput) return;
    const lines = terminalOutput.split('\n').slice(-30);

    for (const line of lines) {
      for (const re of SERVER_REGEXES) {
        const m = line.match(re);
        if (m) {
          const detected = parseInt(m[1], 10);
          if (detected !== port) {
            setPort(detected);
            setStatus('loading');
            setServerError(false);
          }
          break;
        }
      }
    }

    // Check for errors
    const recent = lines.join('\n');
    if (ERROR_REGEXES.some((r) => r.test(recent))) {
      setServerError(true);
    } else {
      setServerError(false);
    }

    // HMR detection
    if (port && HMR_REGEXES.some((r) => r.test(recent))) {
      setIframeKey((k) => k + 1);
      setHmrFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setHmrFlash(false), 800);
    }
  }, [terminalOutput, port]);

  function handleLoad() {
    if (status === 'loading') setStatus('live');
  }

  function handleRefresh() {
    setIframeKey((k) => k + 1);
  }

  function openInBrowser() {
    if (port) window.api.shell.openExternal(`http://localhost:${port}`);
  }

  const setViewportSize = useCallback((v: ViewportSize) => setViewport(v), []);

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
        <span style={styles.portLabel}>localhost:{port}</span>
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
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title="Preview"
          onLoad={handleLoad}
          onError={() => { setStatus('error'); setServerError(true); }}
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
