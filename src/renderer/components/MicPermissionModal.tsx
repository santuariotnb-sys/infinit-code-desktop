import React from 'react';

interface MicPermissionModalProps {
  onAllow: () => void;
  onDeny: () => void;
}

export default function MicPermissionModal({ onAllow, onDeny }: MicPermissionModalProps) {
  async function handleAllow() {
    // Abre Preferências do Sistema → Privacidade → Microfone no macOS
    try {
      await window.api.shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
      );
    } catch { /* ignora */ }
    onAllow();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Ícone */}
        <div style={styles.iconWrap}>
          <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
            <rect x="9" y="1" width="10" height="18" rx="5" fill="rgba(63,185,80,0.15)" stroke="#3fb950" strokeWidth="1.5" />
            <path d="M3 15c0 6.075 4.925 11 11 11s11-4.925 11-11" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 26v5" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 31h8" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Título */}
        <p style={styles.title}>Permitir acesso ao microfone</p>

        {/* Descrição */}
        <p style={styles.desc}>
          O Infinit Code precisa acessar o microfone para transcrever sua voz em texto.
          Clique em <strong style={{ color: '#e6edf3' }}>Permitir</strong> para abrir as configurações do macOS
          e autorizar o acesso.
        </p>

        {/* Passos */}
        <div style={styles.steps}>
          {[
            'Clique em "Permitir" abaixo',
            'Em Preferências do Sistema → Privacidade → Microfone',
            'Ative a chave ao lado de "Infinit Code"',
            'Volte e tente novamente',
          ].map((step, i) => (
            <div key={i} style={styles.step}>
              <span style={styles.stepNum}>{i + 1}</span>
              <span style={styles.stepText}>{step}</span>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div style={styles.actions}>
          <button style={styles.btnDeny} onClick={onDeny}>
            Agora não
          </button>
          <button style={styles.btnAllow} onClick={handleAllow}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <path d="M1 7l4 4 7-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Permitir acesso
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
    width: 360,
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
  steps: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    background: 'rgba(240,246,252,0.04)',
    border: '1px solid rgba(240,246,252,0.07)',
    borderRadius: 8,
    padding: '12px 14px',
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'rgba(63,185,80,0.15)',
    border: '1px solid rgba(63,185,80,0.25)',
    color: '#3fb950',
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 11.5,
    color: '#8b949e',
    lineHeight: 1.5,
  },
  actions: {
    width: '100%',
    display: 'flex',
    gap: 8,
    marginTop: 2,
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
