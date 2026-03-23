import React, { useState, useEffect } from 'react';

interface SetupProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error';
  errorMsg?: string;
}

const STEPS_INIT: Step[] = [
  { id: 'node',   label: 'Node.js',       detail: 'Verificando v18+',           status: 'pending' },
  { id: 'git',    label: 'Git',           detail: 'Verificando instalação',     status: 'pending' },
  { id: 'claude', label: 'Claude Code',   detail: 'npm install -g @anthropic',  status: 'pending' },
  { id: 'skills', label: 'Skills Infinit', detail: '5 skills pré-configuradas', status: 'pending' },
  { id: 'config', label: 'Configurações', detail: 'Ajustes finais',             status: 'pending' },
];

const LOGO_SVG = (
  <svg width="36" height="22" viewBox="0 0 24 15" fill="none" style={{ position: 'relative', zIndex: 2 }}>
    <path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.4"/>
    <path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

function StepIcon({ status }: { status: Step['status'] }) {
  if (status === 'done') return (
    <div className="ob-step-icon ok">
      <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
        <path d="M1 5L4.5 8.5L12 1" stroke="#3CB043" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </div>
  );
  if (status === 'active') return (
    <div className="ob-step-icon spin">
      <svg className="ob-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="rgba(60,176,67,0.25)" strokeWidth="2"/>
        <path d="M8 2A6 6 0 0 1 14 8" stroke="#3CB043" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  );
  if (status === 'error') return (
    <div className="ob-step-icon err">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 2l8 8M10 2l-8 8" stroke="#d93030" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </div>
  );
  return (
    <div className="ob-step-icon idle">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <circle cx="4" cy="4" r="3" stroke="#a8aab4" strokeWidth="1.2"/>
      </svg>
    </div>
  );
}

export default function Setup({ onComplete }: SetupProps) {
  const [steps, setSteps] = useState<Step[]>(STEPS_INIT);
  const [message, setMessage] = useState('Verificando seu ambiente...');
  const [progress, setProgress] = useState(0);
  const [needNode, setNeedNode] = useState(false);
  const [needGit, setNeedGit] = useState(false);
  const [needClaude, setNeedClaude] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const [waitingAuth, setWaitingAuth] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [checkAuthFailed, setCheckAuthFailed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  function markStep(id: string, status: Step['status'], detail?: string, errorMsg?: string) {
    setSteps((prev) => prev.map((s) =>
      s.id === id
        ? { ...s, status, ...(detail ? { detail } : {}), ...(errorMsg ? { errorMsg } : {}) }
        : s
    ));
  }

  function markAllDone() {
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })));
  }

  useEffect(() => {
    // Se setup já foi concluído em sessão anterior, detecta imediatamente
    checkAuth();

    const cleanupProgress = window.api.setup.onProgress((data) => {
      setProgress(data.pct);
      setMessage(data.msg);

      if (data.step === 'done') {
        markAllDone();
        checkAuth();
        return;
      }

      if (data.status === 'error') {
        markStep(data.step, 'error', data.msg, data.msg);
      } else if (data.status === 'done') {
        markStep(data.step, 'done');
      } else {
        markStep(data.step, 'active', data.msg);
      }
    });

    const cleanupNeedNode = window.api.setup.onNeedNode(() => {
      setNeedNode(true);
      setMessage('Node.js precisa ser instalado');
      markStep('node', 'error', 'Não encontrado', 'Node.js 18+ não encontrado no sistema');
    });

    const cleanupNeedGit = window.api.setup.onNeedGit?.(() => {
      setNeedGit(true);
      setMessage('Git não instalado');
      markStep('git', 'error', 'Não encontrado', 'Git não encontrado após tentativa de instalação');
    });

    const cleanupNeedClaude = window.api.setup.onNeedClaude?.(() => {
      setNeedClaude(true);
      setMessage('Falha ao instalar Claude Code');
      markStep('claude', 'error', 'Falha na instalação', 'Execute: npm install -g @anthropic-ai/claude-code');
    });

    const cleanupComplete = window.api.setup.onComplete(() => checkAuth());

    return () => {
      cleanupProgress();
      cleanupNeedNode();
      cleanupNeedGit?.();
      cleanupNeedClaude?.();
      cleanupComplete();
    };
  }, []);

  async function checkAuth() {
    setCheckAuthFailed(false);
    setCheckingAuth(true);
    setMessage('Verificando autenticação...');
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      const auth = await Promise.race([window.api.claude.checkAuth(), timeout]);
      if (auth.authenticated) {
        setIsDone(true);
        setProgress(100);
        setMessage('Tudo pronto! Vamos codar.');
        markAllDone();
      } else {
        setNeedAuth(true);
        setMessage('Conecte sua conta Claude para continuar');
      }
    } catch {
      setCheckAuthFailed(true);
      setMessage('Falha ao verificar autenticação');
    } finally {
      setCheckingAuth(false);
    }
  }

  function handleOpenAuth() {
    setWaitingAuth(true);
    window.api.claude.openAuth();
    const cleanup = window.api.claude.onAuthenticated(() => {
      setWaitingAuth(false);
      setNeedAuth(false);
      setIsDone(true);
      setProgress(100);
      setMessage('Tudo pronto! Vamos codar.');
      markAllDone();
      cleanup();
    });
  }

  async function handleRetryClaude() {
    setNeedClaude(false);
    markStep('claude', 'active', 'Tentando novamente...');
    setMessage('Reinstalando Claude Code...');
    const result = await window.api.claude.install();
    if (result.success) {
      markStep('claude', 'done');
      setMessage('Claude Code instalado! Verificando auth...');
      await checkAuth();
    } else {
      markStep('claude', 'error', 'Falha na instalação', result.error || 'Erro desconhecido');
      setNeedClaude(true);
      setMessage('Falha ao instalar Claude Code');
    }
  }

  const hasBlocker = needNode || needGit || needClaude;

  return (
    <div className="ob-bg">
      <div className="glass-card" style={{ width: '100%', maxWidth: 520, padding: '52px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, marginBottom: 40, position: 'relative', zIndex: 1 }}>
          <div className="ob-logo-box">{LOGO_SVG}</div>
          <div>
            <div style={{ fontFamily: 'DM Sans, -apple-system, sans-serif', fontSize: 22, fontWeight: 300, color: '#3a3d45', letterSpacing: '.01em' }}>
              Infinit <b style={{ fontWeight: 500, color: '#3CB043' }}>Code</b>
            </div>
            <div style={{ fontSize: 13, color: '#a8aab4', fontFamily: 'monospace', letterSpacing: '.02em' }}>Configurando seu ambiente</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 32, position: 'relative', zIndex: 1 }}>
          {steps.map((step) => (
            <div key={step.id}>
              <div className={`ob-step ${step.status}`}>
                <StepIcon status={step.status} />
                <div className="ob-step-text" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    color: step.status === 'pending' ? '#a8aab4' : step.status === 'error' ? '#d93030' : '#3a3d45',
                    fontWeight: step.status === 'active' ? 500 : 300,
                    lineHeight: 1,
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: step.status === 'error' ? '#d9303099' : step.status === 'active' ? '#72757f' : '#c8cad4',
                    fontFamily: 'monospace', marginTop: 2, lineHeight: 1,
                  }}>
                    {step.detail}
                  </div>
                </div>
                {step.status === 'done' && (
                  <div style={{ fontSize: 10, color: '#3CB043', fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>ok</div>
                )}
              </div>

              {/* Mensagem de erro inline por step */}
              {step.status === 'error' && step.errorMsg && (
                <div style={{
                  marginTop: 4, marginLeft: 32, padding: '8px 12px',
                  background: 'rgba(217,48,48,0.06)', borderRadius: 8,
                  border: '1px solid rgba(217,48,48,0.15)',
                }}>
                  <p style={{ fontSize: 11, color: '#d93030', fontFamily: 'monospace', margin: 0, lineHeight: 1.5 }}>
                    {step.errorMsg}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="ob-progress-track" style={{ marginBottom: 12 }}>
          <div className="ob-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Message */}
        <p style={{ fontSize: 13, color: '#72757f', textAlign: 'center', fontFamily: 'monospace', marginBottom: 28, position: 'relative', zIndex: 1 }}>
          {message}
        </p>

        {/* Blocker: Node.js não encontrado */}
        {needNode && (
          <div style={styles.blocker}>
            <div style={styles.blockerTitle}>Node.js não encontrado</div>
            <p style={styles.blockerText}>
              O Node.js 18+ é necessário para rodar o Claude Code. Instale e reinicie o app.
            </p>
            <button className="ob-btn-primary" onClick={() => window.api.shell.openExternal('https://nodejs.org/en/download')}>
              <span style={{ position: 'relative', zIndex: 1 }}>Baixar Node.js →</span>
            </button>
            <p style={styles.blockerHint}>Após instalar, reinicie o Infinit Code.</p>
          </div>
        )}

        {/* Blocker: Git não instalado */}
        {needGit && (
          <div style={styles.blocker}>
            <div style={styles.blockerTitle}>Git não encontrado</div>
            <p style={styles.blockerText}>
              O Git é necessário para controle de versão. Instale e reinicie o app.
            </p>
            <button className="ob-btn-primary" onClick={() => window.api.shell.openExternal('https://git-scm.com/downloads')}>
              <span style={{ position: 'relative', zIndex: 1 }}>Baixar Git →</span>
            </button>
            <p style={styles.blockerHint}>Após instalar, reinicie o Infinit Code.</p>
          </div>
        )}

        {/* Blocker: Claude Code falhou — com retry */}
        {needClaude && (
          <div style={styles.blocker}>
            <div style={styles.blockerTitle}>Falha ao instalar Claude Code</div>
            <p style={styles.blockerText}>
              A instalação automática falhou. Tente novamente ou instale manualmente.
            </p>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button className="ob-btn-primary" onClick={handleRetryClaude}>
                <span style={{ position: 'relative', zIndex: 1 }}>Tentar novamente</span>
              </button>
              <button
                style={{ ...styles.btnSecondary }}
                onClick={() => window.api.shell.openExternal('https://docs.anthropic.com/claude-code')}
              >
                Instalar manualmente
              </button>
            </div>
            <p style={styles.blockerHint}>npm install -g @anthropic-ai/claude-code</p>
          </div>
        )}

        {/* Fallback: checkAuth falhou ou timeout */}
        {(checkAuthFailed || checkingAuth) && !hasBlocker && (
          <div style={styles.blocker}>
            <div style={styles.blockerTitle}>
              {checkingAuth ? 'Verificando...' : 'Erro ao verificar autenticação'}
            </div>
            <p style={styles.blockerText}>
              {checkingAuth
                ? 'Aguarde enquanto verificamos sua conta Claude.'
                : 'Não foi possível verificar sua conta Claude. Verifique sua conexão e tente novamente.'}
            </p>
            <button className="ob-btn-primary" onClick={checkAuth} disabled={checkingAuth}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                {checkingAuth ? 'Verificando...' : 'Tentar novamente'}
              </span>
            </button>
          </div>
        )}

        {/* Auth: conectar Claude */}
        {needAuth && !waitingAuth && !hasBlocker && (
          <div style={styles.authCard}>
            <div style={styles.blockerTitle}>Conectar conta Claude</div>
            <p style={styles.blockerText}>
              Faça login com Google ou email para ativar o Claude Code.
            </p>
            <button className="ob-btn-primary" onClick={handleOpenAuth}>
              <span style={{ position: 'relative', zIndex: 1 }}>Abrir claude.ai →</span>
            </button>
          </div>
        )}

        {/* Aguardando autenticação */}
        {waitingAuth && (
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, color: '#3a3d45', marginBottom: 6 }}>
              <svg className="ob-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="rgba(60,176,67,0.25)" strokeWidth="2"/>
                <path d="M8 2A6 6 0 0 1 14 8" stroke="#3CB043" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Aguardando autenticação...
            </div>
            <p style={{ fontSize: 11, color: '#a8aab4', fontFamily: 'monospace' }}>
              Detectaremos automaticamente quando fizer login
            </p>
          </div>
        )}

        {/* Pronto */}
        {isDone && (
          <button className="ob-btn-primary" onClick={onComplete} style={{ position: 'relative', zIndex: 1 }}>
            <span style={{ position: 'relative', zIndex: 1 }}>Abrir o IDE →</span>
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  blocker: {
    background: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: '20px 22px',
    marginBottom: 16, border: '1px solid rgba(217,48,48,0.12)',
    position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10,
  },
  authCard: {
    background: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: '20px 22px',
    position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10,
  },
  blockerTitle: { fontSize: 13, fontWeight: 500, color: '#d93030' },
  blockerText: { fontSize: 13, color: '#72757f', lineHeight: 1.6, margin: 0, fontWeight: 300 },
  blockerHint: { fontSize: 11, color: '#a8aab4', textAlign: 'center', margin: 0, fontFamily: 'monospace' },
  btnSecondary: {
    background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 10, padding: '10px 18px', cursor: 'pointer',
    color: '#72757f', fontSize: 13, fontFamily: 'DM Sans, -apple-system, sans-serif',
  },
};
