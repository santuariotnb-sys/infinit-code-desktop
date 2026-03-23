import React, { useState, useEffect } from 'react';

type VoiceState = 'idle' | 'listening' | 'processing';

export default function VoiceButton() {
  const [state, setState] = useState<VoiceState>('idle');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    window.api.claude.voiceStatus().then((s) => {
      setSupported(s.supported);
    }).catch(() => setSupported(false));
  }, []);

  async function handleClick() {
    if (!supported) return;
    setState('listening');
    await window.api.claude.voiceStart();
    setTimeout(() => setState('idle'), 3000);
  }

  if (!supported) return null;

  return (
    <button
      style={{
        ...styles.btn,
        ...(state !== 'idle' ? styles.active : {}),
      }}
      onClick={handleClick}
      title="Voz (Space)"
    >
      <span style={styles.icon}>🎤</span>
      {state === 'listening' && (
        <span style={styles.wave}>
          {[1, 2, 3].map((i) => (
            <span key={i} style={{ ...styles.bar, animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      )}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '14px',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  active: {
    background: 'rgba(0,255,136,0.12)',
    color: '#00ff88',
  },
  icon: { fontSize: 13 },
  wave: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    height: 12,
  },
  bar: {
    width: 2,
    height: '100%',
    background: '#00ff88',
    borderRadius: 2,
    animation: 'voiceWave 0.5s ease-in-out infinite alternate',
  },
};
