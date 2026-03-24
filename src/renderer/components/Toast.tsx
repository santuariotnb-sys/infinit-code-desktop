import React from 'react';

interface ToastProps {
  msg: string | null;
}

export default function Toast({ msg }: ToastProps) {
  const visible = msg !== null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
        zIndex: 2000,
        background: 'rgba(30,33,40,0.92)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        padding: '7px 16px',
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        opacity: visible ? 1 : 0,
        transition: 'all .2s',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {msg}
    </div>
  );
}
