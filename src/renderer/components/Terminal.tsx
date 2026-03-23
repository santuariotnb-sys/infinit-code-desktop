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

    // Small delay to ensure container is sized
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send user input to pty
    term.onData((data) => {
      window.api.terminal.write(data);
    });

    // Receive pty output
    const cleanup = window.api.terminal.onData((data) => {
      term.write(data);
    });

    // Resize
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          window.api.terminal.resize(dims.cols, dims.rows);
        }
      }
    });
    observer.observe(containerRef.current);

    return () => {
      cleanup();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px 8px',
        background: '#0a0a0a',
      }}
    />
  );
}
