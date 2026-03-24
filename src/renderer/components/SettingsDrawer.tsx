import React, { useState } from 'react';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface ToggleSetting {
  id: string;
  label: string;
  value?: string;
  defaultOn: boolean;
  isPort?: boolean;
}

interface SettingsGroup {
  title: string;
  items: ToggleSetting[];
}

const GROUPS: SettingsGroup[] = [
  {
    title: 'Editor',
    items: [
      { id: 'autosave',  label: 'Auto-save',  value: '500ms', defaultOn: true },
      { id: 'wordwrap',  label: 'Word wrap',                  defaultOn: false },
      { id: 'minimap',   label: 'Minimap',                    defaultOn: true },
    ],
  },
  {
    title: 'Claude Code',
    items: [
      { id: 'autostart', label: 'Auto-start',        defaultOn: true },
      { id: 'voice',     label: 'Voz PT-BR',          defaultOn: true },
      { id: 'skills',    label: 'Skills automáticas', defaultOn: true },
    ],
  },
  {
    title: 'Preview',
    items: [
      { id: 'autoreload', label: 'Auto-reload',   defaultOn: true },
      { id: 'port',       label: 'Porta padrão', value: '3000', defaultOn: true, isPort: true },
    ],
  },
];

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const initialState: Record<string, boolean> = {};
  GROUPS.forEach((g) => g.items.forEach((item) => { initialState[item.id] = item.defaultOn; }));
  const [toggles, setToggles] = useState<Record<string, boolean>>(initialState);

  function handleToggle(id: string, isPort?: boolean) {
    if (isPort) return; // port is read-only
    setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const togStyle = (on: boolean): React.CSSProperties => ({
    width: 34,
    height: 18,
    background: on ? '#3CB043' : 'rgba(0,0,0,0.1)',
    borderRadius: 9,
    position: 'relative',
    cursor: 'pointer',
    transition: 'background .2s',
    flexShrink: 0,
  });

  const togKnob = (on: boolean): React.CSSProperties => ({
    content: '',
    position: 'absolute',
    width: 12,
    height: 12,
    background: 'white',
    borderRadius: '50%',
    top: 3,
    left: 3,
    transform: on ? 'translateX(16px)' : 'translateX(0)',
    transition: 'transform .2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        right: 0,
        bottom: 22,
        width: 280,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(218,221,228,0.95)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderLeft: '1px solid rgba(255,255,255,0.55)',
        overflow: 'hidden',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .22s cubic-bezier(.22,1,.36,1)',
        pointerEvents: open ? 'all' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        height: 42,
        borderBottom: '1px solid rgba(255,255,255,0.55)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
        background: 'rgba(213,216,222,0.9)',
      }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="1.8" stroke="#72757f" strokeWidth="1.2" />
          <path d="M7 1v1.3M7 11.7V13M1 7h1.3M11.7 7H13M2.8 2.8l.9.9M10.3 10.3l.9.9M10.3 2.8l-.9.9M2.8 10.3l.9-.9" stroke="#72757f" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 13, color: '#3a3d45', flex: 1 }}>Configurações</div>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24,
            background: 'rgba(255,255,255,0.5)',
            border: 'none',
            borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: '#a8aab4',
            fontSize: 12,
            boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset',
            transition: 'all .12s',
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#a8aab4',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 10,
            }}>
              {group.title}
            </div>
            {group.items.map((item) => {
              const isOn = toggles[item.id];
              const clickable = !item.isPort;
              return (
                <div
                  key={item.id}
                  onClick={() => clickable && handleToggle(item.id, item.isPort)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9px 11px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.5)',
                    marginBottom: 4,
                    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'all .12s',
                  }}
                >
                  <div style={{ flex: 1, fontSize: 12.5, color: '#3a3d45', fontWeight: 300 }}>
                    {item.label}
                  </div>
                  {item.value && !item.isPort && (
                    <div style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace", marginRight: 7 }}>
                      {item.value}
                    </div>
                  )}
                  {item.isPort ? (
                    <div style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.value}
                    </div>
                  ) : (
                    <div style={togStyle(isOn)}>
                      <div style={togKnob(isOn)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
