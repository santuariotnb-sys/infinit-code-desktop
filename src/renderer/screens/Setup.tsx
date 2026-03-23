import React, { useState, useEffect } from 'react';

interface SetupProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export default function Setup({ onComplete }: SetupProps) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 'node', label: 'Node.js', status: 'pending' },
    { id: 'git', label: 'Git', status: 'pending' },
    { id: 'claude', label: 'Claude Code', status: 'pending' },
    { id: 'skills', label: 'Skills Infinit', status: 'pending' },
    { id: 'config', label: 'Configurações', status: 'pending' },
  ]);
  const [message, setMessage] = useState('Verificando seu ambiente...');
  const [progress, setProgress] = useState(0);
  const [needNode, setNeedNode] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [waitingAuth, setWaitingAuth] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const cleanupProgress = window.api.setup.onProgress((data) => {
      setProgress(data.pct);
      setMessage(data.msg);

      setSteps((prev) =>
        prev.map((step) => {
          if (step.id === data.step) {
            return { ...step, status: data.msg.includes('✓') ? 'done' : 'active' };
          }
          if (data.step === 'done') {
            return { ...step, status: 'done' };
          }
          return step;
        })
      );

      if (data.step === 'done') {
        checkAuth();
      }
    });

    const cleanupNeedNode = window.api.setup.onNeedNode(() => {
      setNeedNode(true);
      setMessage('Node.js precisa ser instalado');
    });

    const cleanupComplete = window.api.setup.onComplete(() => {
      checkAuth();
    });

    return () => {
      cleanupProgress();
      cleanupNeedNode();
      cleanupComplete();
    };
  }, []);

  async function checkAuth() {
    const auth = await window.api.claude.checkAuth();
    if (auth.authenticated) {
      setDone(true);
      setMessage('Tudo pronto! Vamos codar.');
    } else {
      setNeedAuth(true);
      setMessage('Conecte sua conta Claude');
    }
  }

  function handleOpenAuth() {
    setWaitingAuth(true);
    window.api.claude.openAuth();

    const cleanup = window.api.claude.onAuthenticated(() => {
      setWaitingAuth(false);
      setNeedAuth(false);
      setDone(true);
      setMessage('Tudo pronto! Vamos codar.');
      cleanup();
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.logo}>
          <span style={styles.infinity}>∞</span>
          <span style={styles.logoText}>Infinit Code</span>
        </div>

        <div style={styles.stepsContainer}>
          {steps.map((step, i) => (
            <div
              key={step.id}
              style={{
                ...styles.step,
                animation: `slideIn 0.3s ease-out ${i * 0.1}s both`,
              }}
            >
              <div style={styles.stepIcon}>
                {step.status === 'done' && <span style={styles.checkmark}>✓</span>}
                {step.status === 'active' && <span className="spin" style={styles.spinner}>◌</span>}
                {step.status === 'pending' && <span style={styles.pending}>○</span>}
                {step.status === 'error' && <span style={styles.errorIcon}>✕</span>}
              </div>
              <span
                style={{
                  ...styles.stepLabel,
                  color: step.status === 'done' ? '#00ff88' : step.status === 'active' ? '#fff' : '#555',
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div style={styles.progressContainer}>
          <div style={{ ...styles.progressBar, width: `${progress}%` }} />
        </div>

        <p style={styles.message}>{message}</p>

        {needNode && (
          <div style={styles.actionBlock} className="fade-in">
            <p style={styles.actionText}>
              O Node.js 18+ é necessário para rodar o Infinit Code.
            </p>
            <button
              style={styles.button}
              onClick={() => window.api.shell.openExternal('https://nodejs.org/en/download')}
            >
              Baixar Node.js →
            </button>
            <p style={styles.hint}>Após instalar, reinicie o Infinit Code.</p>
          </div>
        )}

        {needAuth && !waitingAuth && (
          <div style={styles.actionBlock} className="fade-in">
            <p style={styles.actionText}>
              Faça login com Google ou email para conectar o Claude.
            </p>
            <button style={styles.button} onClick={handleOpenAuth}>
              Abrir claude.ai →
            </button>
          </div>
        )}

        {waitingAuth && (
          <div style={styles.actionBlock} className="fade-in">
            <p style={styles.waitingText}>
              <span className="pulse">⏳</span> Aguardando autenticação...
            </p>
            <p style={styles.hint}>Detectaremos automaticamente quando fizer login</p>
          </div>
        )}

        {done && (
          <button style={styles.mainButton} onClick={onComplete} className="fade-in">
            Abrir IDE
          </button>
        )}
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
    gap: '32px',
    maxWidth: '400px',
    width: '100%',
    padding: '0 24px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  infinity: {
    fontSize: '48px',
    color: '#00ff88',
    fontWeight: 300,
  },
  logoText: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
  },
  stepIcon: {
    width: '24px',
    textAlign: 'center' as const,
    fontSize: '16px',
  },
  checkmark: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  spinner: {
    color: '#fff',
    display: 'inline-block',
  },
  pending: {
    color: '#555',
  },
  errorIcon: {
    color: '#ff4444',
  },
  stepLabel: {
    fontSize: '15px',
    fontWeight: 500,
  },
  progressContainer: {
    width: '100%',
    height: '4px',
    background: '#1a1a1a',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #00ff88, #00cc6a)',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  message: {
    color: '#888',
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  actionBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '24px',
    background: '#111',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    width: '100%',
  },
  actionText: {
    color: '#ccc',
    fontSize: '14px',
    textAlign: 'center' as const,
    lineHeight: '1.5',
  },
  button: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  hint: {
    color: '#555',
    fontSize: '12px',
  },
  waitingText: {
    color: '#fff',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mainButton: {
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    padding: '16px 48px',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '-0.3px',
  },
};
