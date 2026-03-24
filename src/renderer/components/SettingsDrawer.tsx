import React from 'react';
import { Settings } from '../hooks/useSettings';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdate: (key: keyof Settings, value: boolean | number) => void;
}

interface SettingItem {
  key: keyof Settings;
  label: string;
  hint?: string;
  isPort?: boolean;
}

interface SettingsGroup {
  title: string;
  items: SettingItem[];
}

const GROUPS: SettingsGroup[] = [
  {
    title: 'Editor',
    items: [
      { key: 'autoSave', label: 'Auto-save', hint: '500ms' },
      { key: 'wordWrap', label: 'Word wrap' },
      { key: 'minimap', label: 'Minimap' },
    ],
  },
  {
    title: 'Claude Code',
    items: [
      { key: 'claudeAutoStart', label: 'Auto-start' },
      { key: 'voicePtBr', label: 'Voz PT-BR' },
      { key: 'autoSkills', label: 'Skills automáticas' },
    ],
  },
  {
    title: 'Preview',
    items: [
      { key: 'previewAutoReload', label: 'Auto-reload' },
      { key: 'defaultPort', label: 'Porta padrão', isPort: true },
    ],
  },
];

export default function SettingsDrawer({ open, onClose, settings, onUpdate }: SettingsDrawerProps) {
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
              if (item.isPort) {
                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '9px 11px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.5)',
                      marginBottom: 4,
                      boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 12.5, color: '#3a3d45', fontWeight: 300 }}>
                      {item.label}
                    </div>
                    <input
                      type="number"
                      value={settings[item.key] as number}
                      onChange={(e) => onUpdate(item.key, parseInt(e.target.value, 10) || 3000)}
                      style={{
                        width: 64,
                        background: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 5,
                        padding: '3px 7px',
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#3a3d45',
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                  </div>
                );
              }

              const isOn = settings[item.key] as boolean;
              return (
                <div
                  key={item.key}
                  onClick={() => onUpdate(item.key, !isOn)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '9px 11px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.5)',
                    marginBottom: 4,
                    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
                    cursor: 'pointer',
                    transition: 'all .12s',
                  }}
                >
                  <div style={{ flex: 1, fontSize: 12.5, color: '#3a3d45', fontWeight: 300 }}>
                    {item.label}
                  </div>
                  {item.hint && (
                    <div style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace", marginRight: 7 }}>
                      {item.hint}
                    </div>
                  )}
                  <div style={togStyle(isOn)}>
                    <div style={togKnob(isOn)} />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
