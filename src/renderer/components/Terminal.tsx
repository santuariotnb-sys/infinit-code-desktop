import React, { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
      scrollback: 10000,
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
    const createPty = () => {
      window.api.terminal.create().then(() => {
        try { fitAddon.fit(); } catch { /* ignore */ }
      }).catch(() => {
        // Tenta novamente após 1s se falhar
        setTimeout(createPty, 1000);
      });
    };
    createPty();

    // Input do usuário → PTY
    term.onData((data) => {
      window.api.terminal.write(data);
    });

    // Saída do PTY → xterm
    const cleanupData = window.api.terminal.onData((data) => {
      term.write(data);
    });

    // Auto-restart quando PTY morre inesperadamente
    const cleanupExit = window.api.terminal.onExit?.(() => {
      if (!termRef.current) return; // componente já desmontado
      term.write('\r\n\x1b[33m[terminal reiniciando...]\x1b[0m\r\n');
      setTimeout(() => {
        if (!termRef.current) return;
        createPty();
      }, 800);
    }) ?? (() => {});

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
      }, 60);
    });
    observer.observe(containerRef.current);

    return () => {
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
    </div>
  );
}
