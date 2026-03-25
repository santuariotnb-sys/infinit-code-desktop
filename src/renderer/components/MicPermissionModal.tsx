import React, { useState } from 'react';

interface MicPermissionModalProps {
  /** Chamado com o stream obtido quando o macOS concedeu acesso */
  onGranted: (stream: MediaStream) => void;
  /** Chamado quando o usuário recusou ou fechou sem agir */
  onDeny: () => void;
}

type State = 'idle' | 'requesting' | 'denied-permanent';

export default function MicPermissionModal({ onGranted, onDeny }: MicPermissionModalProps) {
  const [state, setState] = useState<State>('idle');

  async function handleAllow() {
    setState('requesting');
    try {
      // Chama getUserMedia — isso aciona o dialog nativo do macOS diretamente
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Usuário clicou "Permitir" no dialog → acesso concedido
      onGranted(stream);
    } catch (err) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        // Usuário clicou "Não Permitir" no dialog do macOS
        // Verifica se é bloqueio permanente (app já foi bloqueado antes) ou só recusa no dialog
        try {
          const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (perm.state === 'denied') {
            // Bloqueio permanente — precisa ir em Preferências do Sistema
            setState('denied-permanent');
          } else {
            onDeny();
          }
        } catch {
          onDeny();
        }
      } else {
        onDeny();
      }
    }
  }

  async function handleOpenPrefs() {
    await window.api.shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
    );
    onDeny();
  }

  // ── Estado: bloqueio permanente ──────────────────────────
  if (state === 'denied-permanent') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={{ ...styles.iconWrap, borderColor: 'rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.07)' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <circle cx="13" cy="13" r="11.5" stroke="#f85149" strokeWidth="1.5" />
              <path d="M13 8v5M13 17v.5" stroke="#f85149" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p style={styles.title}>Acesso bloqueado</p>
          <p style={styles.desc}>
            O macOS bloqueou o microfone para este app. Abra{' '}
            <strong style={{ color: '#e6edf3' }}>Preferências do Sistema → Privacidade → Microfone</strong>{' '}
            e ative o Infinit Code.
          </p>
          <div style={styles.actions}>
            <button style={styles.btnDeny} onClick={onDeny}>Fechar</button>
            <button style={{ ...styles.btnAllow, background: '#b62324', borderColor: 'rgba(248,81,73,0.4)' }} onClick={handleOpenPrefs}>
              Abrir Preferências
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado: aguardando dialog do macOS ───────────────────
  if (state === 'requesting') {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.modal, gap: 16 }}>
          <div style={styles.iconWrap}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#3fb950" strokeWidth="1.5" strokeDasharray="4 3"
                style={{ animation: 'spin 1.2s linear infinite', transformOrigin: '14px 14px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </svg>
          </div>
          <p style={{ ...styles.title, fontSize: 13 }}>Aguardando permissão…</p>
          <p style={{ ...styles.desc, fontSize: 11 }}>
            Responda ao diálogo do macOS que apareceu.
          </p>
        </div>
      </div>
    );
  }

  // ── Estado padrão: pede para clicar em Permitir ──────────
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.iconWrap}>
          <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
            <rect x="9" y="1" width="10" height="18" rx="5" fill="rgba(63,185,80,0.15)" stroke="#3fb950" strokeWidth="1.5" />
            <path d="M3 15c0 6.075 4.925 11 11 11s11-4.925 11-11" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 26v5" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 31h8" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <p style={styles.title}>Permitir acesso ao microfone</p>

        <p style={styles.desc}>
          O Infinit Code precisa acessar o microfone para transcrever sua voz em texto.
          Clique em <strong style={{ color: '#e6edf3' }}>Permitir</strong> e depois confirme
          no diálogo do macOS.
        </p>

        <div style={styles.actions}>
          <button style={styles.btnDeny} onClick={onDeny}>
            Agora não
          </button>
          <button style={styles.btnAllow} onClick={handleAllow}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 7l4 4 7-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Permitir
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 999999,
    background: 'rgba(1,4,9,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modal: {
    width: 340,
    background: '#161b22',
    border: '1px solid rgba(240,246,252,0.12)',
    borderRadius: 12,
    padding: '28px 24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'rgba(63,185,80,0.08)',
    border: '1px solid rgba(63,185,80,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e6edf3',
    textAlign: 'center',
  },
  desc: {
    margin: 0,
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  actions: {
    width: '100%',
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  btnDeny: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid rgba(240,246,252,0.1)',
    color: '#8b949e',
    fontSize: 12.5,
    cursor: 'pointer',
  },
  btnAllow: {
    flex: 2,
    height: 36,
    borderRadius: 8,
    background: '#238636',
    border: '1px solid rgba(63,185,80,0.4)',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
};
