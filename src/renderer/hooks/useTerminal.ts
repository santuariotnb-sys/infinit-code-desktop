import { useState, useEffect, useRef } from 'react';
import { detectPort } from '../lib/portDetect';

interface UseTerminalOptions {
  onPortDetected?: (port: number) => void;
}

export function useTerminal({ onPortDetected }: UseTerminalOptions = {}) {
  const [terminalOutput, setTerminalOutput] = useState('');
  const [ghostOutput, setGhostOutput] = useState('');
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const outputRef = useRef('');
  const ghostRef = useRef('');
  const detectedPortRef = useRef<number | null>(null);
  const onPortDetectedRef = useRef(onPortDetected);
  const ghostOpInProgress = useRef(false);

  // Mantém callback sempre atualizado sem recriar o effect
  onPortDetectedRef.current = onPortDetected;

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
        onPortDetectedRef.current?.(port);
      }
    });

    const exitCleanup = window.api.terminal.ghost.onExit(() => {
      // Ghost morreu — limpa porta detectada para que Preview mostre idle
      // (não reseta detectedPort para não piscar o preview se server ainda está rodando)
    });

    return () => {
      cleanup();
      exitCleanup();
      // Matar ghost process ao desmontar para não vazar processos dev server
      window.api.terminal.ghost.kill().catch?.(() => {});
    };
  }, []);

  function appendOutput(line: string) {
    setTerminalOutput((prev) => prev + '\n' + line);
  }

  function writeToTerminal(text: string) {
    window.api.terminal.write(text);
  }

  async function runDevServer(pkgManager = 'npm', cwd?: string) {
    const cmd =
      pkgManager === 'bun'  ? 'bun dev' :
      pkgManager === 'pnpm' ? 'pnpm run dev' :
      pkgManager === 'yarn' ? 'yarn dev' : 'npm run dev';

    if (cwd) {
      // Evita race condition: ignora chamada se outra operação ghost está em andamento
      if (ghostOpInProgress.current) return;
      ghostOpInProgress.current = true;
      try {
        await window.api.terminal.ghost.kill();
        ghostRef.current = '';
        setGhostOutput('');
        detectedPortRef.current = null;
        setDetectedPort(null);
        await window.api.terminal.ghost.create(cwd);
        window.api.terminal.ghost.write(cmd + '\r');
      } finally {
        ghostOpInProgress.current = false;
      }
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
