import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TERMINAL } from '../lib/constants';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [frozen, setFrozen] = useState(false);
  const lastDataTime = useRef(Date.now());
  const frozenCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRestart = useCallback(async () => {
    const term = termRef.current;
    if (term) {
      term.clear();
      term.write('\r\n\x1b[33m[reiniciando terminal...]\x1b[0m\r\n');
    }
    setFrozen(false);
    lastDataTime.current = Date.now();
    await window.api.terminal.restart();
    try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#00ff88',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(0, 255, 136, 0.2)',
        black: '#1a1a1a',
        red: '#ff4444',
        green: '#00ff88',
        yellow: '#ffaa00',
        blue: '#4488ff',
        magenta: '#cc66ff',
        cyan: '#00cccc',
        white: '#e0e0e0',
        brightBlack: '#555555',
        brightRed: '#ff6666',
        brightGreen: '#33ffaa',
        brightYellow: '#ffcc33',
        brightBlue: '#66aaff',
        brightMagenta: '#dd88ff',
        brightCyan: '#33dddd',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Cria PTY — idempotente, só cria se não existe
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const createPty = () => {
      window.api.terminal.create().then(() => {
        if (!mounted) return;
        try { fitAddon.fit(); } catch { /* ignore */ }
      }).catch(() => {
        if (!mounted) return;
        retryTimer = setTimeout(createPty, TERMINAL.PTY_RETRY_DELAY_MS);
      });
    };
    createPty();

    // Input do usuário → PTY
    // Reseta o timer de frozen ao digitar
    term.onData((data) => {
      lastDataTime.current = Date.now();
      setFrozen(false);
      window.api.terminal.write(data);
    });

    // Saída do PTY → xterm
    const cleanupData = window.api.terminal.onData((data) => {
      lastDataTime.current = Date.now();
      setFrozen(false);
      term.write(data);
    });

    // Auto-restart quando PTY morre inesperadamente
    const cleanupExit = window.api.terminal.onExit?.(() => {
      if (!termRef.current) return;
      term.write('\r\n\x1b[33m[terminal reiniciando...]\x1b[0m\r\n');
      setTimeout(() => {
        if (!termRef.current) return;
        createPty();
      }, 800);
    }) ?? (() => {});

    // Detecta terminal frozen: se nenhum dado entra/sai por 15s após input do user
    let userTypedRecently = false;
    const origOnData = term.onData;
    term.onKey(() => { userTypedRecently = true; });
    frozenCheckRef.current = setInterval(() => {
      if (!userTypedRecently) return;
      const elapsed = Date.now() - lastDataTime.current;
      if (elapsed > 15_000) {
        setFrozen(true);
        userTypedRecently = false;
      }
    }, 5_000);

    // Resize com debounce para não sobrecarregar o PTY
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (!fitAddonRef.current || !containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (offsetWidth < 20 || offsetHeight < 20) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const dims = fitAddonRef.current?.proposeDimensions();
          if (dims && dims.cols > 0 && dims.rows > 0) {
            window.api.terminal.resize(dims.cols, dims.rows);
          }
        } catch { /* ignore */ }
      }, TERMINAL.RESIZE_DEBOUNCE_MS);
    });
    observer.observe(containerRef.current);

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (frozenCheckRef.current) clearInterval(frozenCheckRef.current);
      cleanupData();
      cleanupExit();
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      const filePath = (file as File & { path?: string }).path ?? file.name;
      window.api.terminal.write(filePath.includes(' ') ? `"${filePath}"` : filePath);
    }
    termRef.current?.focus();
  }

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={() => termRef.current?.focus()}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '4px 8px',
          background: '#0a0a0a',
        }}
      />
      {frozen && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255, 170, 0, 0.15)',
          border: '1px solid rgba(255, 170, 0, 0.3)',
          borderRadius: 6,
          padding: '4px 10px',
          zIndex: 10,
        }}>
          <span style={{ fontSize: 11, color: '#ffaa00', fontFamily: 'monospace' }}>
            Terminal sem resposta
          </span>
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255, 170, 0, 0.2)',
              border: '1px solid rgba(255, 170, 0, 0.4)',
              borderRadius: 4,
              color: '#ffaa00',
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Reiniciar
          </button>
        </div>
      )}
    </div>
  );
}
