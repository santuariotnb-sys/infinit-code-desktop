import React, { useState, useEffect, useRef } from 'react';

interface GitHubAuthModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: (user: string) => void;
}

type Step = 'choose' | 'device' | 'pat';

export default function GitHubAuthModal({ open, onClose, onConnected }: GitHubAuthModalProps) {
  const [step, setStep] = useState<Step>('choose');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('https://github.com/login/device');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pat, setPat] = useState('');
  const [copied, setCopied] = useState(false);
  const pollAbortRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setStep('choose');
      setUserCode('');
      setError('');
      setPat('');
      pollAbortRef.current = true;
    } else {
      pollAbortRef.current = false;
    }
  }, [open]);

  async function startDeviceFlow() {
    setLoading(true);
    setError('');
    try {
      const res = await window.api.github.deviceFlowStart();
      if (!res.ok) { setError(res.error || 'Erro ao iniciar Device Flow'); setLoading(false); return; }
      setUserCode(res.userCode);
      setVerificationUri(res.verificationUri || 'https://github.com/login/device');
      setStep('device');
      setLoading(false);
      window.api.shell.openExternal(res.verificationUri || 'https://github.com/login/device');
      pollAbortRef.current = false;
      const result = await window.api.github.deviceFlowPoll(res.deviceCode, res.interval);
      if (pollAbortRef.current) return;
      if (result.connected && result.user) {
        onConnected(result.user);
      } else {
        setError(result.error || 'Falhou. Tente novamente.');
        setStep('choose');
      }
    } catch (e) {
      setError(String(e));
      setLoading(false);
      setStep('choose');
    }
  }

  async function savePat() {
    if (!pat.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await window.api.github.savePat(pat.trim());
      if (res.ok && res.user) {
        onConnected(res.user);
      } else {
        setError(res.error || 'Token inválido');
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  function copyCode() {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!open) return null;

  return (
    <div style={s.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#3a3d45">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span style={s.title}>Conectar GitHub</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {step === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={s.desc}>Escolha como conectar sua conta GitHub:</p>

              <button style={s.optionBtn} onClick={startDeviceFlow} disabled={loading}>
                <div style={s.optionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3CB043" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div style={s.optionText}>
                  <div style={s.optionTitle}>Device Flow <span style={s.rec}>Recomendado</span></div>
                  <div style={s.optionSub}>Abre o GitHub no browser — sem senha no app</div>
                </div>
              </button>

              <button style={{ ...s.optionBtn, opacity: 0.85 }} onClick={() => setStep('pat')}>
                <div style={s.optionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#72757f" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div style={s.optionText}>
                  <div style={{ ...s.optionTitle, color: '#3a3d45' }}>Personal Access Token</div>
                  <div style={s.optionSub}>Cole um token criado em github.com/settings/tokens</div>
                </div>
              </button>

              {error && <p style={s.err}>{error}</p>}
              {loading && <p style={s.info}>Aguarde...</p>}
            </div>
          )}

          {step === 'device' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <p style={s.desc}>Insira o código abaixo em <strong>github.com/login/device</strong></p>

              <div style={s.codeBox}>
                <span style={s.codeText}>{userCode}</span>
                <button style={s.copyBtn} onClick={copyCode}>{copied ? '✓' : 'Copiar'}</button>
              </div>

              <button
                style={s.openBtn}
                onClick={() => window.api.shell.openExternal(verificationUri)}
              >
                Abrir github.com/login/device
              </button>

              <div style={s.waiting}>
                <span style={s.waitDot} />
                Aguardando autorização no GitHub...
              </div>

              {error && <p style={s.err}>{error}</p>}

              <button style={s.backBtn} onClick={() => { pollAbortRef.current = true; setStep('choose'); setError(''); }}>
                ← Voltar
              </button>
            </div>
          )}

          {step === 'pat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={s.desc}>Cole um token com escopos <code style={s.code}>repo</code> e <code style={s.code}>user</code>:</p>
              <input
                style={s.patInput}
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePat()}
                autoFocus
              />
              <a
                href="#"
                style={s.link}
                onClick={(e) => { e.preventDefault(); window.api.shell.openExternal('https://github.com/settings/tokens/new?scopes=repo,user&description=Infinit+Code'); }}
              >
                Criar token no GitHub →
              </a>
              {error && <p style={s.err}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.backBtn} onClick={() => { setStep('choose'); setError(''); setPat(''); }}>← Voltar</button>
                <button style={s.primaryBtn} onClick={savePat} disabled={loading || !pat.trim()}>
                  {loading ? 'Verificando...' : 'Conectar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ghWaitPulse {
          0%,100%{opacity:.3;transform:scale(1)}
          50%{opacity:1;transform:scale(1.4)}
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(175,178,186,0.45)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: 400, background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 14,
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 24px 60px rgba(0,0,0,0.14)',
    border: '1px solid rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.5)',
    background: 'rgba(213,216,222,0.7)',
  },
  title: { flex: 1, fontSize: 13, fontWeight: 500, color: '#1a1c20', fontFamily: "'DM Sans', sans-serif" },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: '#a8aab4', padding: '2px 5px', borderRadius: 4,
  },
  body: { padding: 20 },
  desc: { fontSize: 12.5, color: '#3a3d45', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", margin: 0 },
  optionBtn: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' as const,
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all .15s', width: '100%',
  },
  optionIcon: {
    width: 36, height: 36, borderRadius: 8,
    background: 'rgba(255,255,255,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset',
  },
  optionText: { display: 'flex', flexDirection: 'column', gap: 2 },
  optionTitle: { fontSize: 13, color: '#3CB043', fontWeight: 500, fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 6 },
  optionSub: { fontSize: 11, color: '#72757f', fontFamily: "'DM Sans', sans-serif" },
  rec: { fontSize: 9.5, background: 'rgba(60,176,67,0.12)', color: '#3CB043', padding: '1px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" },
  codeBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '12px 16px',
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
  },
  codeText: { fontSize: 22, letterSpacing: '0.15em', fontFamily: "'JetBrains Mono', monospace", color: '#1a1c20', flex: 1, textAlign: 'center' as const },
  copyBtn: {
    background: 'rgba(60,176,67,0.1)', border: '1px solid rgba(60,176,67,0.25)',
    borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#3CB043',
    cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
  },
  openBtn: {
    background: '#1a1c20', color: 'rgba(255,255,255,0.9)', border: 'none',
    borderRadius: 8, padding: '9px 18px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', width: '100%',
  },
  waiting: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12, color: '#72757f', fontFamily: "'JetBrains Mono', monospace",
  },
  waitDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#3CB043', flexShrink: 0,
    animation: 'ghWaitPulse 1.2s ease-in-out infinite',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 7, padding: '7px 12px', fontSize: 11.5, color: '#72757f',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif',",
  },
  primaryBtn: {
    flex: 1, background: '#3CB043', color: 'white', border: 'none',
    borderRadius: 7, padding: '7px 16px', fontSize: 11.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    boxShadow: '0 2px 8px rgba(60,176,67,0.25)',
  },
  patInput: {
    width: '100%', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 8, padding: '10px 12px', fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace", color: '#1a1c20', outline: 'none',
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
  },
  link: { fontSize: 11.5, color: '#3CB043', cursor: 'pointer', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" },
  code: { background: 'rgba(0,0,0,0.06)', borderRadius: 3, padding: '1px 5px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
  err: { fontSize: 11.5, color: '#d04040', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  info: { fontSize: 11.5, color: '#72757f', margin: 0, fontFamily: "'JetBrains Mono', monospace" },
};
