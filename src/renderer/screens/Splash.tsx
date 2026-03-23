import React, { useEffect, useState } from 'react';

export default function Splash() {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.88) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes subtitleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 0.5; transform: translateY(0); }
        }
        @keyframes barFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes splashOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes drawPath {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: '#dde0e5',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        animation: phase === 'out' ? 'splashOut .4s ease forwards' : 'none',
        // @ts-expect-error electron drag region
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}>

        {/* Logo */}
        <div style={{
          animation: 'logoIn .6s cubic-bezier(.22,1,.36,1) both',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        }}>
          <div style={{
            width: 80, height: 80,
            background: 'rgba(255,255,255,0.72)',
            borderRadius: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 32px rgba(0,0,0,0.10)',
          }}>
            <svg width="48" height="30" viewBox="0 0 24 15" fill="none">
              <path
                d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z"
                stroke="#3CB043" strokeWidth="1.4" fill="none"
                strokeDasharray="200" style={{ animation: 'drawPath .8s .2s ease both' }}
              />
              <path
                d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z"
                stroke="#3CB043" strokeWidth="1.4" fill="none"
                strokeDasharray="200" style={{ animation: 'drawPath .8s .35s ease both' }}
              />
              <path
                d="M8.5 7.5H15.5"
                stroke="#3CB043" strokeWidth="1.4"
                strokeDasharray="200" style={{ animation: 'drawPath .4s .55s ease both' }}
              />
              <path
                d="M18.5 4.5L21.5 7L18 10.5"
                stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"
                strokeDasharray="200" style={{ animation: 'drawPath .4s .7s ease both' }}
              />
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 28, fontWeight: 400,
              color: '#1a1c20', letterSpacing: '-.02em',
              margin: 0,
            }}>
              Infinit <em style={{ color: '#3CB043', fontStyle: 'italic' }}>Code</em>
            </h1>
            <p style={{
              fontSize: 12, color: '#8a8d96', margin: '6px 0 0',
              fontWeight: 300, letterSpacing: '.02em',
              animation: 'subtitleIn .5s .8s both',
            }}>
              Powered by Claude Code
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          background: 'rgba(255,255,255,0.3)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: '#3CB043',
            animation: 'barFill 2.2s .3s cubic-bezier(.4,0,.2,1) both',
          }} />
        </div>

      </div>
    </>
  );
}
