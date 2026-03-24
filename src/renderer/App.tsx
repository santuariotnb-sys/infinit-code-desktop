import React, { useState, useEffect } from 'react';
import Splash   from './screens/Splash';
import Login    from './screens/Login';
import License  from './screens/License';
import IDE      from './screens/IDE';

type Screen = 'splash' | 'login' | 'license' | 'ide';

const SPLASH_MIN_MS = 2300;

export default function App() {
  const [screen, setScreen]       = useState<Screen>('splash');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const splashStart = Date.now();

    async function bootCheck() {
      // 1. Aguarda splash mínimo
      const elapsed   = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, remaining));

      // 2. Verifica sessão de auth
      const session = await window.api.auth.getSession();
      if (!session) {
        setScreen('login');
        return;
      }

      setUserEmail(session.email ?? '');

      // 3. Verifica licença armazenada
      const license = await window.api.license.getStored();
      if (!license) {
        setScreen('license');
        return;
      }

      setScreen('ide');
    }

    bootCheck();

    const cleanupSetup = window.api.setup.onComplete(() => {});
    return cleanupSetup;
  }, []);

  // Após login bem-sucedido → checa licença
  async function handleLogin() {
    const session = await window.api.auth.getSession();
    setUserEmail(session?.email ?? '');

    const license = await window.api.license.getStored();
    setScreen(license ? 'ide' : 'license');
  }

  // Após licença ativada → IDE
  function handleLicenseActivated() {
    setScreen('ide');
  }

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <>
      {isMac && screen !== 'splash' && screen !== 'login' && (
        <div className="titlebar-drag" />
      )}
      {screen === 'splash'  && <Splash />}
      {screen === 'login'   && <Login onLogin={handleLogin} />}
      {screen === 'license' && <License email={userEmail} onActivated={handleLicenseActivated} />}
      {screen === 'ide'     && <IDE />}
    </>
  );
}
