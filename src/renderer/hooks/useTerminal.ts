import { useState, useEffect, useRef } from 'react';

interface UseTerminalOptions {
  onPortDetected?: (port: number) => void;
}

export function useTerminal({ onPortDetected }: UseTerminalOptions = {}) {
  const [terminalOutput, setTerminalOutput] = useState('');
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const outputRef = useRef('');

  useEffect(() => {
    const cleanup = window.api.terminal.onData((data: string) => {
      outputRef.current = (outputRef.current + data).split('\n').slice(-300).join('\n');
      setTerminalOutput(outputRef.current);

      // Detecta porta de servidor: Next.js, Vite, CRA, Express, Fastify, Remix, Astro
      const portMatch =
        data.match(/(?:localhost|127\.0\.0\.1):(\d{4,5})/i) ||
        data.match(/Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1):(\d{4,5})/i) ||
        data.match(/(?:started|running|listening|server).{0,40}?:(\d{4,5})/i) ||
        data.match(/(?:ready|available).{0,40}?port[:\s]+(\d{4,5})/i) ||
        data.match(/on port[:\s]+(\d{4,5})/i) ||
        data.match(/:\s*(\d{4,5})\s*(?:→|->|\()/i);

      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        if (port >= 1024 && port <= 65535) {
          setDetectedPort(port);
          onPortDetected?.(port);
        }
      }
    });

    const injectCleanup = window.api.terminal.onInject?.((text: string) => {
      window.api.terminal.write(text);
    });

    return () => {
      cleanup();
      injectCleanup?.();
    };
  }, []);

  function appendOutput(line: string) {
    setTerminalOutput((prev) => prev + '\n' + line);
  }

  function writeToTerminal(text: string) {
    window.api.terminal.write(text);
  }

  function runDevServer() {
    window.api.terminal.write('npm run dev\r');
  }

  return {
    terminalOutput,
    detectedPort,
    isExpanded,
    setIsExpanded,
    appendOutput,
    writeToTerminal,
    runDevServer,
  };
}
