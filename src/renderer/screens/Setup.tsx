import React, { useState, useEffect } from 'react';

interface SetupProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

const STEPS_INIT: Step[] = [
  { id: 'node',   label: 'Node.js',          detail: 'Verificando v18+',          status: 'pending' },
  { id: 'git',    label: 'Git',               detail: 'Verificando instalação',    status: 'pending' },
  { id: 'claude', label: 'Claude Code',       detail: 'npm install -g @anthropic', status: 'pending' },
  { id: 'skills', label: 'Skills Infinit',    detail: '6 skills pré-configuradas', status: 'pending' },
  { id: 'config', label: 'Configurações',     detail: 'Ajustes finais',            status: 'pending' },
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
      <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 5L4.5 8.5L12 1" stroke="#3CB043" strokeWidth="1.6" strokeLinecap="round"/></svg>
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
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#d93030" strokeWidth="1.4" strokeLinecap="round"/></svg>
    </div>
  );
  return (
    <div className="ob-step-icon idle">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" stroke="#a8aab4" strokeWidth="1.2"/></svg>
    </div>
  );
}

export default function Setup({ onComplete }: SetupProps) {
  const [steps, setSteps] = useState<Step[]>(STEPS_INIT);
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
          if (step.id === data.step) return { ...step, status: data.msg.includes('✓') ? 'done' : 'active' };
          if (data.step === 'done') return { ...step, status: 'done' };
          return step;
        })
      );
      if (data.step === 'done') checkAuth();
    });

    const cleanupNeedNode = window.api.setup.onNeedNode(() => {
      setNeedNode(true);
      setMessage('Node.js precisa ser instalado');
      setSteps((prev) => prev.map((s) => s.id === 'node' ? { ...s, status: 'error' } : s));
    });

    const cleanupComplete = window.api.setup.onComplete(() => checkAuth());

    return () => { cleanupProgress(); cleanupNeedNode(); cleanupComplete(); };
  }, []);

  async function checkAuth() {
    const auth = await window.api.claude.checkAuth();
    if (auth.authenticated) {
      setDone(true);
      setProgress(100);
      setMessage('Tudo pronto! Vamos codar.');
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
    } else {
      setNeedAuth(true);
      setMessage('Conecte sua conta Claude para continuar');
    }
  }

  function handleOpenAuth() {
    setWaitingAuth(true);
    window.api.claude.openAuth();
    const cleanup = window.api.claude.onAuthenticated(() => {
      setWaitingAuth(false);
      setNeedAuth(false);
      setDone(true);
      setProgress(100);
      setMessage('Tudo pronto! Vamos codar.');
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      cleanup();
    });
  }

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
            <div key={step.id} className={`ob-step ${step.status}`}>
              <StepIcon status={step.status} />
              <div className="ob-step-text" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 13, color: step.status === 'pending' ? '#a8aab4' : '#3a3d45', fontWeight: step.status === 'active' ? 500 : 300, lineHeight: 1 }}>{step.label}</div>
                <div style={{ fontSize: 11, color: step.status === 'active' ? '#72757f' : '#c8cad4', fontFamily: 'monospace', marginTop: 2, lineHeight: 1 }}>{step.detail}</div>
              </div>
              {step.status === 'done' && (
                <div style={{ fontSize: 10, color: '#3CB043', fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>ok</div>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="ob-progress-track" style={{ marginBottom: 12 }}>
          <div className="ob-progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Message */}
        <p style={{ fontSize: 13, color: '#72757f', textAlign: 'center', fontFamily: 'monospace', marginBottom: 28, position: 'relative', zIndex: 1 }}>{message}</p>

        {/* Need Node */}
        {needNode && (
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: '20px 22px', marginBottom: 16, border: '1px solid rgba(217,48,48,0.12)', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#d93030', marginBottom: 6 }}>Node.js não encontrado</div>
            <p style={{ fontSize: 13, color: '#72757f', lineHeight: 1.6, marginBottom: 14, fontWeight: 300 }}>O Node.js 18+ é necessário para rodar o Infinit Code.</p>
            <button className="ob-btn-primary" onClick={() => window.api.shell.openExternal('https://nodejs.org/en/download')}>
              <span style={{ position: 'relative', zIndex: 1 }}>Baixar Node.js →</span>
            </button>
            <p style={{ fontSize: 11, color: '#a8aab4', textAlign: 'center', marginTop: 10, fontFamily: 'monospace' }}>Após instalar, reinicie o Infinit Code.</p>
          </div>
        )}

        {/* Need Auth */}
        {needAuth && !waitingAuth && (
          <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: '20px 22px', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1c20', marginBottom: 6 }}>Conectar conta Claude</div>
            <p style={{ fontSize: 13, color: '#72757f', lineHeight: 1.6, marginBottom: 14, fontWeight: 300 }}>Faça login com Google ou email para ativar o Claude Code.</p>
            <button className="ob-btn-primary" onClick={handleOpenAuth}>
              <span style={{ position: 'relative', zIndex: 1 }}>Abrir claude.ai →</span>
            </button>
          </div>
        )}

        {/* Waiting auth */}
        {waitingAuth && (
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, color: '#3a3d45', marginBottom: 6 }}>
              <svg className="ob-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="rgba(60,176,67,0.25)" strokeWidth="2"/>
                <path d="M8 2A6 6 0 0 1 14 8" stroke="#3CB043" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Aguardando autenticação...
            </div>
            <p style={{ fontSize: 11, color: '#a8aab4', fontFamily: 'monospace' }}>Detectaremos automaticamente quando fizer login</p>
          </div>
        )}

        {/* Done */}
        {done && (
          <button className="ob-btn-primary" onClick={onComplete} style={{ position: 'relative', zIndex: 1 }}>
            <span style={{ position: 'relative', zIndex: 1 }}>Abrir o IDE →</span>
          </button>
        )}
      </div>
    </div>
  );
}
