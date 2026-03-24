import React, { useState } from 'react';

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`;

const LOGO = (
  <svg width="36" height="22" viewBox="0 0 24 15" fill="none">
    <path d="M8.5 7.5C8.5 7.5 6 2 3 2C1.2 2 .5 3.8 .5 7.5C.5 11.2 1.2 13 3 13C6 13 8.5 7.5 8.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M15.5 7.5C15.5 7.5 18 2 21 2C22.8 2 23.5 3.8 23.5 7.5C23.5 11.2 22.8 13 21 13C18 13 15.5 7.5 15.5 7.5Z" stroke="#3CB043" strokeWidth="1.4" fill="none"/>
    <path d="M8.5 7.5H15.5" stroke="#3CB043" strokeWidth="1.4"/>
    <path d="M18.5 4.5L21.5 7L18 10.5" stroke="#3CB043" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
  </svg>
);

const GITHUB_ICON = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>
);

const GOOGLE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState('');

  async function handleGitHub() {
    setLoading('github');
    setError('');
    try {
      const result = await window.api.auth.loginGithub();
      if (result.ok) {
        onLogin();
      } else {
        setError(result.error || 'Falha no login com GitHub.');
      }
    } catch {
      setError('Erro ao conectar com GitHub.');
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setLoading('google');
    setError('');
    try {
      const result = await window.api.auth.loginGoogle();
      if (result.ok) {
        onLogin();
      } else if (result.error?.includes('não configurado')) {
        setError('Login com Google ainda não disponível nesta versão. Use o GitHub.');
      } else {
        setError(result.error || 'Falha no login com Google.');
      }
    } catch {
      setError('Erro ao conectar com Google.');
    } finally {
      setLoading(null);
    }
  }

  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderRadius: 20,
    boxShadow: '0 1px 0 rgba(255,255,255,0.85) inset, 0 8px 40px rgba(0,0,0,0.08)',
  };

  const btn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '13px 20px',
    background: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 11, cursor: active ? 'wait' : 'pointer',
    fontSize: 14, fontWeight: 500, color: '#1a1c20',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all .15s',
    opacity: active ? 0.7 : 1,
  });

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-btn:hover { background: rgba(255,255,255,0.9) !important; transform: translateY(-1px); }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#e0e3e8', backgroundImage: NOISE,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24,
      }}>

        {/* Card */}
        <div style={{
          ...glass, width: '100%', maxWidth: 380,
          padding: '40px 36px',
          animation: 'fadeUp .45s cubic-bezier(.22,1,.36,1) both',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        }}>

          {/* Logo */}
          <div style={{
            width: 60, height: 60,
            background: 'rgba(255,255,255,0.75)', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 16px rgba(0,0,0,0.07)',
            marginBottom: 20,
          }}>
            {LOGO}
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: 22, fontWeight: 500, color: '#1a1c20',
            letterSpacing: '-.02em', margin: '0 0 6px', textAlign: 'center',
          }}>
            Bem-vindo ao Infinit <span style={{ color: '#3CB043' }}>Code</span>
          </h1>
          <p style={{
            fontSize: 13, color: '#8a8d96', fontWeight: 300,
            margin: '0 0 32px', textAlign: 'center', lineHeight: 1.5,
          }}>
            Faça login para continuar
          </p>

          {/* Botões */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="login-btn"
              style={btn(loading === 'github')}
              onClick={handleGitHub}
              disabled={loading !== null}
            >
              {GITHUB_ICON}
              {loading === 'github' ? 'Aguardando GitHub...' : 'Entrar com GitHub'}
            </button>

            <button
              className="login-btn"
              style={btn(loading === 'google')}
              onClick={handleGoogle}
              disabled={loading !== null}
            >
              {GOOGLE_ICON}
              {loading === 'google' ? 'Aguardando Google...' : 'Entrar com Google'}
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px', width: '100%',
              background: 'rgba(255,80,80,0.08)', borderRadius: 9,
              fontSize: 12, color: '#d44', textAlign: 'center', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Rodapé */}
          <p style={{
            marginTop: 28, fontSize: 11, color: '#b0b3bc',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            Ao entrar você aceita os{' '}
            <span style={{ color: '#8a8d96', cursor: 'pointer' }}>Termos de Uso</span>
            {' '}e a{' '}
            <span style={{ color: '#8a8d96', cursor: 'pointer' }}>Política de Privacidade</span>.
          </p>
        </div>
      </div>
    </>
  );
}
