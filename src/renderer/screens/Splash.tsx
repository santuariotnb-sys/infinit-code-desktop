import React, { useEffect, useRef, useState } from 'react';
// @ts-expect-error mp4 asset
import logoVideo from '../assets/logo-animation.mp4';

// Fallback: 5 ícones caso o vídeo falhe
const ICONS = [
  { label: 'Infinit', svg: (<svg width="28" height="18" viewBox="0 0 24 15" fill="none"><path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.5" fill="none"/><path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.5" fill="none"/><path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.5"/><path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>) },
  { label: 'Monaco', svg: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#6C8EBF" strokeWidth="1.4" fill="none"/><path d="M6 8l3 3-3 3" stroke="#6C8EBF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M12 14h4" stroke="#6C8EBF" strokeWidth="1.4" strokeLinecap="round"/></svg>) },
  { label: 'Terminal', svg: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="3" stroke="#72757f" strokeWidth="1.4" fill="none"/><path d="M6 8.5l4 2.5-4 2.5" stroke="#72757f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M13 13.5h3" stroke="#72757f" strokeWidth="1.4" strokeLinecap="round"/></svg>) },
  { label: 'GitHub', svg: (<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2C6.03 2 2 6.03 2 11c0 3.98 2.58 7.35 6.16 8.54.45.08.61-.19.61-.43v-1.52c-2.5.54-3.03-1.2-3.03-1.2-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.37 2.1.97 2.61.74.08-.58.31-.97.57-1.2-1.99-.23-4.09-1-4.09-4.43 0-.98.35-1.78.93-2.4-.09-.23-.4-1.14.09-2.37 0 0 .76-.24 2.48.93A8.6 8.6 0 0 1 11 6.84c.77 0 1.54.1 2.26.3 1.72-1.17 2.48-.93 2.48-.93.49 1.23.18 2.14.09 2.37.58.62.93 1.42.93 2.4 0 3.44-2.1 4.2-4.1 4.42.32.28.61.83.61 1.67v2.48c0 .24.16.52.62.43A9.01 9.01 0 0 0 20 11c0-4.97-4.03-9-9-9Z" fill="#72757f"/></svg>) },
  { label: 'Claude', svg: (<svg width="28" height="18" viewBox="0 0 24 15" fill="none"><path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.5" fill="none"/><path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.5" fill="rgba(60,176,67,0.12)"/><path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.5"/><path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>) },
];

const FADEOUT_DUR_MS = 400;

export default function Splash() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [out, setOut] = useState(false);

  // Fallback icon state
  const [visible, setVisible] = useState<boolean[]>(ICONS.map(() => false));

  useEffect(() => {
    if (!videoFailed) return;
    // Fallback: anima ícones
    const timers: ReturnType<typeof setTimeout>[] = [];
    ICONS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisible((prev) => { const n = [...prev]; n[i] = true; return n; });
      }, i * 300));
    });
    timers.push(setTimeout(() => setOut(true), ICONS.length * 300 + 400));
    return () => timers.forEach(clearTimeout);
  }, [videoFailed]);

  function handleVideoEnded() {
    setOut(true);
  }

  function handleVideoError() {
    setVideoFailed(true);
  }

  return (
    <>
      <style>{`
        @keyframes iconIn {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes barFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes splashOut {
          from { opacity: 1; }
          to   { opacity: 0; pointer-events: none; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: '#dde0e5',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: out ? `splashOut ${FADEOUT_DUR_MS}ms ease forwards` : 'none',
        // @ts-expect-error electron drag region
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        overflow: 'hidden',
      }}>
        {!videoFailed ? (
          <video
            ref={videoRef}
            src={logoVideo}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <>
            <div style={{ textAlign: 'center', opacity: visible[0] ? 1 : 0, transition: 'opacity .4s', marginBottom: 40 }}>
              <h1 style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 26, fontWeight: 400, color: '#1a1c20', letterSpacing: '-.02em', margin: 0 }}>
                Infinit <em style={{ color: '#3CB043', fontStyle: 'italic' }}>Code</em>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {ICONS.map((icon, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0, animation: visible[i] ? 'iconIn .4s cubic-bezier(.22,1,.36,1) forwards' : 'none' }}>
                  <div style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.72)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 16px rgba(0,0,0,0.08)' }}>
                    {icon.svg}
                  </div>
                  <span style={{ fontSize: 10, color: '#8a8d96', fontWeight: 300, letterSpacing: '.03em' }}>{icon.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Barra de progresso */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#3CB043', animation: `barFill 2.5s .1s cubic-bezier(.4,0,.2,1) both` }} />
        </div>
      </div>
    </>
  );
}
