import React, { useRef, useEffect } from 'react';

interface VoiceWaveformProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  isListening: boolean;
}

const BAR_COUNT = 28;
const BAR_GAP = 3;
const BAR_WIDTH = 3;
const HEIGHT = 44;
const WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

export default function VoiceWaveform({ analyserRef, isListening }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isListening) {
      cancelAnimationFrame(rafRef.current);
      // Limpa canvas com fade suave
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(BAR_COUNT);
    let frame = 0;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      frame++;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        // Se sem analyser, usa animação senoidal sintética
        const raw = analyser ? dataArray[i] : 0;
        const synthetic = analyser ? 0 : (
          Math.sin(frame * 0.08 + i * 0.4) * 0.35 +
          Math.sin(frame * 0.13 + i * 0.7) * 0.25 +
          0.15
        );
        const norm = analyser ? raw / 255 : synthetic;
        const minH = 3;
        const maxH = HEIGHT - 6;
        const barH = Math.max(minH, norm * maxH);

        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (HEIGHT - barH) / 2;

        // Gradiente verde → ciano com intensidade
        const intensity = Math.min(1, norm * 1.4);
        const r = Math.round(0 + intensity * 30);
        const g = Math.round(200 + intensity * 55);
        const b = Math.round(100 + intensity * 155);
        ctx!.fillStyle = `rgba(${r},${g},${b},${0.55 + intensity * 0.45})`;
        ctx!.beginPath();
        ctx!.roundRect(x, y, BAR_WIDTH, barH, 1.5);
        ctx!.fill();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isListening, analyserRef]);

  if (!isListening) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 12px 4px',
      borderBottom: '1px solid rgba(0,200,100,0.12)',
      background: 'rgba(0,255,136,0.04)',
      flexShrink: 0,
    }}>
      {/* Ponto pulsante */}
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#00ff88',
        flexShrink: 0,
        boxShadow: '0 0 6px rgba(0,255,136,0.7)',
        animation: 'wfDot .9s ease-in-out infinite',
      }} />

      {/* Canvas com barras de frequência */}
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ display: 'block', flexShrink: 0 }}
      />

      <span style={{
        fontSize: 10,
        color: 'rgba(0,255,136,0.7)',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '.04em',
        flexShrink: 0,
      }}>
        ouvindo...
      </span>

      <style>{`
        @keyframes wfDot {
          0%,100% { transform:scale(1); opacity:.7 }
          50%      { transform:scale(1.5); opacity:1 }
        }
      `}</style>
    </div>
  );
}
