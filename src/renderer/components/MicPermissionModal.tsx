import React from 'react';

interface MicPermissionModalProps {
  onDeny: () => void;
}

export default function MicPermissionModal({ onDeny }: MicPermissionModalProps) {
  async function handleOpenPrefs() {
    await window.api.shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
    );
    onDeny();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={{ ...styles.iconWrap, borderColor: 'rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.07)' }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="11.5" stroke="#f85149" strokeWidth="1.5" />
            <path d="M13 8v5M13 17v.5" stroke="#f85149" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        <p style={styles.title}>Acesso ao microfone bloqueado</p>

        <p style={styles.desc}>
          O macOS bloqueou o microfone para o Infinit Code. Abra{' '}
          <strong style={{ color: '#e6edf3' }}>Preferências do Sistema → Privacidade → Microfone</strong>{' '}
          e ative o app.
        </p>

        <div style={styles.actions}>
          <button style={styles.btnDeny} onClick={onDeny}>Fechar</button>
          <button
            style={{ ...styles.btnAction, background: '#b62324', borderColor: 'rgba(248,81,73,0.4)' }}
            onClick={handleOpenPrefs}
          >
            Abrir Preferências
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
  btnAction: {
    flex: 2,
    height: 36,
    borderRadius: 8,
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
  },
};
