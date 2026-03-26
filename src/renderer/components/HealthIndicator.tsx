import React, { useEffect, useState } from 'react';

interface HealthStatus {
  claudeCli: 'ok' | 'not-installed' | 'not-authenticated' | 'error';
  terminal: 'ok' | 'dead' | 'not-started';
  preview: 'ok' | 'unreachable' | 'not-running';
  lastCheck: string;
}

const STATUS_COLOR: Record<string, string> = {
  ok: '#3fb950',
  'not-started': '#8b949e',
  'not-running': '#8b949e',
  'not-installed': '#d29922',
  'not-authenticated': '#d29922',
  error: '#f85149',
  dead: '#f85149',
  unreachable: '#f85149',
};

function dot(status: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: STATUS_COLOR[status] ?? '#8b949e',
        flexShrink: 0,
      }}
    />
  );
}

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Carga inicial
    window.api.health.get().then((res: { ok: boolean; data?: HealthStatus }) => {
      if (res.ok && res.data) setHealth(res.data);
    });

    // Escuta atualizações
    const off = window.api.health.onUpdated((data: HealthStatus) => {
      setHealth(data);
    });
    return off;
  }, []);

  if (!health) return null;

  const isHealthy =
    health.claudeCli === 'ok' &&
    health.terminal !== 'dead' &&
    health.preview !== 'unreachable';

  const globalColor = isHealthy ? '#3fb950' : '#d29922';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Status do sistema"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 4,
          color: '#8b949e',
          fontSize: 11,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: globalColor,
            display: 'inline-block',
            boxShadow: `0 0 4px ${globalColor}80`,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: 6,
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            padding: '10px 14px',
            minWidth: 190,
            zIndex: 9999,
            boxShadow: '0 8px 24px #0008',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Status do sistema
          </div>
          {[
            { label: 'Claude CLI', value: health.claudeCli },
            { label: 'Terminal', value: health.terminal },
            { label: 'Preview', value: health.preview },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '3px 0',
              }}
            >
              <span style={{ fontSize: 12, color: '#c9d1d9' }}>{label}</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: STATUS_COLOR[value] ?? '#8b949e',
                }}
              >
                {dot(value)}
                {value}
              </span>
            </div>
          ))}
          <div
            style={{
              fontSize: 10,
              color: '#484f58',
              marginTop: 8,
              borderTop: '1px solid #30363d',
              paddingTop: 6,
            }}
          >
            {new Date(health.lastCheck).toLocaleTimeString('pt-BR')}
          </div>
        </div>
      )}
    </div>
  );
}
