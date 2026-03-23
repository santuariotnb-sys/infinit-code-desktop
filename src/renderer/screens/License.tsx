import React, { useState, useRef } from 'react';

interface LicenseProps {
  onActivated: () => void;
}

const LOGO_SVG = (
  <svg width="36" height="22" viewBox="0 0 24 15" fill="none" style={{ position: 'relative', zIndex: 2 }}>
    <path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.4"/>
    <path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

export default function License({ onActivated }: LicenseProps) {
  const [segs, setSegs] = useState(['', '', '', '', '']);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const segRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  function updateSeg(idx: number, val: string) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const next = [...segs];
    next[idx] = clean;
    setSegs(next);
    setError('');
    if (clean.length === 4 && idx < 4) segRefs[idx + 1].current?.focus();
  }

  function handleSegKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && segs[idx].length === 0 && idx > 0) {
      segRefs[idx - 1].current?.focus();
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      const clean = text.trim().toUpperCase().replace(/-/g, '');
      const next = [clean.slice(0,4), clean.slice(4,8), clean.slice(8,12), clean.slice(12,16), clean.slice(16,20)];
      setSegs(next);
      setError('');
    } catch { /* ignore */ }
  }

  function getFullKey() {
    return segs.join('-');
  }

  async function handleActivate() {
    const key = getFullKey();
    if (key.replace(/-/g, '').length < 20) { setError('Preencha todos os segmentos da chave'); return; }
    if (!email || !email.includes('@')) { setError('Email inválido'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await window.api.license.validate(key, email.trim());
      if (result.valid) {
        setSuccess(true);
        setTimeout(onActivated, 2200);
      } else {
        setError(result.error || 'Chave inválida ou já ativada em outro dispositivo');
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ob-bg">
      <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: '52px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, marginBottom: 36, position: 'relative', zIndex: 1 }}>
          <div className="ob-logo-box" style={{ width: 62, height: 62 }}>{LOGO_SVG}</div>
          <div className="ob-tag">Infinit <b style={{ color: '#3CB043', fontWeight: 500 }}>Code</b></div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, fontWeight: 400, color: '#1a1c20', letterSpacing: '-.02em', marginBottom: 4 }}>
              Ative sua <em style={{ color: '#4a4d55', fontStyle: 'italic' }}>licença</em>
            </div>
            <div style={{ fontSize: 13, color: '#72757f', fontWeight: 300, lineHeight: 1.6 }}>
              Cole a chave que você recebeu por email após a compra.
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', zIndex: 1 }}>

          {/* Key segments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', color: '#a8aab4', fontFamily: 'monospace', textTransform: 'uppercase' }}>Chave de ativação</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {segs.map((seg, i) => (
                <React.Fragment key={i}>
                  <input
                    ref={segRefs[i]}
                    className={`ob-key-seg${seg.length === 4 ? ' filled' : ''}`}
                    maxLength={4}
                    placeholder={i === 0 ? 'INFT' : 'XXXX'}
                    value={seg}
                    onChange={(e) => updateSeg(i, e.target.value)}
                    onKeyDown={(e) => handleSegKeyDown(i, e)}
                  />
                  {i < 4 && <span style={{ fontSize: 16, color: '#c8cad4', flexShrink: 0, fontFamily: 'monospace', userSelect: 'none' }}>–</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handlePaste}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, color: '#72757f', fontFamily: 'monospace', cursor: 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 2px 6px rgba(0,0,0,0.07)' }}
              >
                📋 Colar chave
              </button>
              <span style={{ fontSize: 11, color: '#c8cad4', fontFamily: 'monospace' }}>dev: INFT-DEV0-TEST-0000-0000</span>
            </div>
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', color: '#a8aab4', fontFamily: 'monospace', textTransform: 'uppercase' }}>Email da compra</div>
            <input
              className="ob-input"
              type="email"
              placeholder="guilherme@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="ob-error-alert">
              <div style={{ flexShrink: 0, width: 32, height: 32, background: 'rgba(217,48,48,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 4v4M7 10v.5" stroke="#d93030" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="7" r="6" stroke="#d93030" strokeWidth="1.2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#d93030', marginBottom: 2 }}>Erro de ativação</div>
                <div style={{ fontSize: 12, color: '#72757f', fontWeight: 300, lineHeight: 1.4 }}>{error}</div>
              </div>
            </div>
          )}

          {/* Activate button */}
          <button className="ob-btn-primary" onClick={handleActivate} disabled={loading}>
            {loading ? (
              <svg className="ob-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <path d="M10 2A8 8 0 0 1 18 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <span style={{ position: 'relative', zIndex: 1 }}>Ativar e entrar →</span>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: .5, background: 'rgba(255,255,255,0.55)' }} />
            <div style={{ fontSize: 11, color: '#c8cad4', fontFamily: 'monospace' }}>ou</div>
            <div style={{ flex: 1, height: .5, background: 'rgba(255,255,255,0.55)' }} />
          </div>

          <button className="ob-btn-secondary" onClick={() => window.api.shell.openExternal('https://app-infinitcode.netlify.app')}>
            <span style={{ position: 'relative', zIndex: 3 }}>Não tem licença? </span>
            <b style={{ color: '#3CB043', fontWeight: 500, position: 'relative', zIndex: 3 }}>Comprar por R$67/mês →</b>
          </button>

          {/* Security badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 }}>
            {[
              { icon: '🔒', label: 'Validado com segurança' },
              { icon: '✓', label: 'Cancele quando quiser' },
            ].map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#c8cad4', fontFamily: 'monospace' }}>
                <span>{b.icon}</span>{b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Success overlay */}
        {success && (
          <div className="ob-success-overlay">
            <div className="ob-check-box">
              <svg width="40" height="32" viewBox="0 0 40 32" fill="none">
                <path d="M3 16L14 27L37 5" stroke="#3CB043" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, color: '#1a1c20', letterSpacing: '-.02em', position: 'relative', zIndex: 3 }}>Bem-vindo ao Pro.</div>
            <div style={{ fontSize: 14, color: '#72757f', fontWeight: 300, lineHeight: 1.6, position: 'relative', zIndex: 3 }}>
              Sua licença foi ativada.<br/>Claude Code está pronto para usar.
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 20px', boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 4px 14px rgba(0,0,0,0.07)', position: 'relative', zIndex: 3 }}>
              <div style={{ width: 28, height: 28, background: 'rgba(60,176,67,0.12)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="9" viewBox="0 0 24 15" fill="none"><path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.6" fill="none"/><path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.6" fill="none"/><path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.6"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1c20' }}>Infinit Code Pro</div>
                <div style={{ fontSize: 11, color: '#3CB043', fontFamily: 'monospace' }}>{email}</div>
              </div>
            </div>
            <button className="ob-btn-primary" style={{ width: '100%', maxWidth: 280 }} onClick={onActivated}>
              <span style={{ position: 'relative', zIndex: 1 }}>Abrir o IDE →</span>
            </button>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 16, right: 20, fontSize: 10, color: '#c8cad4', fontFamily: 'monospace', zIndex: 10 }}>v1.0.0</div>
      </div>
    </div>
  );
}
