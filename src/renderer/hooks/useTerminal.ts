import { useState, useEffect, useRef } from 'react';

interface UseTerminalOptions {
  onPortDetected?: (port: number) => void;
}

const SERVER_REGEXES = [
  /(?:localhost|127\.0\.0\.1|\[::1\]):(\d{4,5})/,
  /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i,
  /https?:\/\/localhost:(\d{4,5})/i,
  /(?:started|listening|running|available|serving).*?port[:\s]+(\d{4,5})/i,
  /\bon port[:\s]+(\d{4,5})/i,
  /\bport\s+(\d{4,5})\b/i,
];

function detectPort(data: string): number | null {
  for (const re of SERVER_REGEXES) {
    const m = data.match(re);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}

export function useTerminal({ onPortDetected }: UseTerminalOptions = {}) {
  const [terminalOutput, setTerminalOutput] = useState('');
  const [ghostOutput, setGhostOutput] = useState('');
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const outputRef = useRef('');
  const ghostRef = useRef('');
  const detectedPortRef = useRef<number | null>(null);

  // ── Terminal visível do usuário ──────────────────────────────────────────
  useEffect(() => {
    const cleanup = window.api.terminal.onData((data: string) => {
      outputRef.current = (outputRef.current + data).split('\n').slice(-300).join('\n');
      setTerminalOutput(outputRef.current);
    });

    const injectCleanup = window.api.terminal.onInject?.((text: string) => {
      window.api.terminal.write(text);
    });

    return () => {
      cleanup();
      injectCleanup?.();
    };
  }, []);

  // ── Terminal fantasma — dev server ───────────────────────────────────────
  useEffect(() => {
    const cleanup = window.api.terminal.ghost.onData((data: string) => {
      ghostRef.current = (ghostRef.current + data).split('\n').slice(-300).join('\n');
      setGhostOutput(ghostRef.current);

      // Port detection no ghost output
      const port = detectPort(data);
      if (port && port !== detectedPortRef.current) {
        detectedPortRef.current = port;
        setDetectedPort(port);
        onPortDetected?.(port);
      }
    });

    const exitCleanup = window.api.terminal.ghost.onExit(() => {
      // Ghost morreu — limpa porta detectada para que Preview mostre idle
      // (não reseta detectedPort para não piscar o preview se server ainda está rodando)
    });

    return () => {
      cleanup();
      exitCleanup();
    };
  }, []);

  function appendOutput(line: string) {
    setTerminalOutput((prev) => prev + '\n' + line);
  }

  function writeToTerminal(text: string) {
    window.api.terminal.write(text);
  }

  function runDevServer(pkgManager = 'npm', cwd?: string) {
    const cmd =
      pkgManager === 'bun'  ? 'bun dev' :
      pkgManager === 'pnpm' ? 'pnpm run dev' :
      pkgManager === 'yarn' ? 'yarn dev' : 'npm run dev';

    if (cwd) {
      // Mata ghost anterior e cria um novo no cwd do projeto
      window.api.terminal.ghost.kill().then(() => {
        ghostRef.current = '';
        setGhostOutput('');
        detectedPortRef.current = null;
        window.api.terminal.ghost.create(cwd).then(() => {
          window.api.terminal.ghost.write(cmd + '\r');
        });
      });
    } else {
      // Fallback: roda no terminal principal (sem cwd = projeto já no cwd do PTY)
      window.api.terminal.write(cmd + '\r');
    }
  }

  function killDevServer() {
    window.api.terminal.ghost.kill();
    detectedPortRef.current = null;
    setDetectedPort(null);
    ghostRef.current = '';
    setGhostOutput('');
  }

  return {
    terminalOutput,
    ghostOutput,    // output do dev server — usado pelo Preview para port detection
    detectedPort,
    isExpanded,
    setIsExpanded,
    appendOutput,
    writeToTerminal,
    runDevServer,
    killDevServer,
  };
}
