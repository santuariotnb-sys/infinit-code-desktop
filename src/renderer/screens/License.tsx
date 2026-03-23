import React, { useState } from 'react';

interface LicenseProps {
  onActivated: () => void;
}

export default function License({ onActivated }: LicenseProps) {
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleActivate() {
    if (!key.trim() || !email.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.api.license.validate(key.trim(), email.trim());
      if (result.valid) {
        setSuccess(true);
        setTimeout(onActivated, 2000);
      } else {
        setError(result.error || 'Chave inválida ou já ativada em outro dispositivo');
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  }

  function formatKey(value: string): string {
    const clean = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length <= 4) return clean;
    const parts = [];
    // Add INFT prefix
    if (!clean.startsWith('INFT')) {
      parts.push(clean.match(/.{1,4}/g) || []);
      return parts.flat().join('-');
    }
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.substring(i, i + 4));
    }
    return parts.join('-');
  }

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.content} className="fade-in">
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Bem-vindo ao Infinit Code Pro!</h2>
          <p style={styles.successText}>Sua licença foi ativada com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.logo}>
          <span style={styles.infinity}>∞</span>
          <span style={styles.logoText}>Infinit Code</span>
        </div>

        <h2 style={styles.title}>Ativar Licença</h2>

        <div style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Chave de ativação</label>
            <input
              type="text"
              placeholder="INFT-XXXX-XXXX-XXXX-XXXX"
              value={key}
              onChange={(e) => setKey(formatKey(e.target.value))}
              maxLength={24}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{
              ...styles.button,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onClick={handleActivate}
            disabled={loading}
          >
            {loading ? 'Validando...' : 'Ativar'}
          </button>
        </div>

        <button
          style={styles.link}
          onClick={() => window.api.shell.openExternal('https://app-infinitcode.netlify.app')}
        >
          Comprar licença →
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '380px',
    width: '100%',
    padding: '0 24px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  infinity: {
    fontSize: '36px',
    color: '#00ff88',
    fontWeight: 300,
  },
  logoText: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#fff',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    color: '#888',
    fontWeight: 500,
  },
  input: {
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  error: {
    color: '#ff4444',
    fontSize: '13px',
    background: 'rgba(255, 68, 68, 0.1)',
    padding: '8px 12px',
    borderRadius: '6px',
    textAlign: 'center' as const,
  },
  button: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    padding: '14px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '8px',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#00ff88',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(0, 255, 136, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
    color: '#00ff88',
  },
  successTitle: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#fff',
  },
  successText: {
    color: '#888',
    fontSize: '14px',
  },
};
