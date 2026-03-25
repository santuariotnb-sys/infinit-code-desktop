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

    // Cria PTY apenas se ainda não existe (evita matar processo ao remontar)
    window.api.terminal.create().then(() => {
      setTimeout(() => { fitAddon.fit(); }, 50);
    });
    // Nota: terminal.create no main já verifica se PTY existe e não recria.

    // Send user input to pty
    term.onData((data) => {
      window.api.terminal.write(data);
    });

    // Receive pty output
    const cleanup = window.api.terminal.onData((data) => {
      term.write(data);
    });

    // Resize — guarda dimensões mínimas para não travar o pty
    const observer = new ResizeObserver(() => {
      if (!fitAddonRef.current || !containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (offsetWidth < 20 || offsetHeight < 20) return;
      try {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && dims.cols > 0 && dims.rows > 0) {
          window.api.terminal.resize(dims.cols, dims.rows);
        }
      } catch { /* ignore resize errors */ }
    });
    observer.observe(containerRef.current);

    return () => {
      cleanup();
      observer.disconnect();
      // NÃO mata o PTY aqui — o processo continua rodando em background.
      // O PTY só é morto quando a janela fecha (main/ipc/terminal.ts cuida disso).
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
