import React, { useEffect, useState } from 'react';

interface BroadcastMessage {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  expiresAt?: string;
  cta?: { label: string; url: string };
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; icon: string; color: string }> = {
  info: {
    bg: '#0d1117',
    border: '#1f6feb',
    icon: 'ℹ',
    color: '#58a6ff',
  },
  warning: {
    bg: '#0d1117',
    border: '#9e6a03',
    icon: '⚠',
    color: '#d29922',
  },
  critical: {
    bg: '#0d1117',
    border: '#6e2020',
    icon: '✕',
    color: '#f85149',
  },
};

export function BroadcastBanner() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);

  useEffect(() => {
    // Carga inicial
    window.api.broadcast.get().then((res: { ok: boolean; data?: BroadcastMessage[] }) => {
      if (res.ok && res.data) setMessages(res.data);
    });

    // Escuta atualizações do monitor
    const off = window.api.broadcast.onUpdated((data: BroadcastMessage[]) => {
      setMessages(data);
    });
    return off;
  }, []);

  if (messages.length === 0) return null;

  const msg = messages[0]; // Mostra o mais recente
  const style = SEVERITY_STYLE[msg.severity] ?? SEVERITY_STYLE.info;

  function dismiss() {
    window.api.broadcast.dismiss(msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 14px',
        background: style.bg,
        borderBottom: `2px solid ${style.border}`,
        fontSize: 12,
        color: '#c9d1d9',
        zIndex: 100,
        position: 'relative',
      }}
    >
      <span style={{ color: style.color, fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>
        {style.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: style.color, marginRight: 6 }}>
          {msg.title}
        </span>
        <span style={{ color: '#8b949e' }}>{msg.body}</span>
        {msg.cta && (
          <button
            onClick={() => window.api.shell.openExternal(msg.cta!.url)}
            style={{
              marginLeft: 10,
              background: 'none',
              border: `1px solid ${style.border}`,
              borderRadius: 4,
              color: style.color,
              fontSize: 11,
              padding: '1px 8px',
              cursor: 'pointer',
            }}
          >
            {msg.cta.label}
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Fechar"
        style={{
          background: 'none',
          border: 'none',
          color: '#484f58',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
