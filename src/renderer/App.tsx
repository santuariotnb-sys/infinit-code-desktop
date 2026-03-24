import React, { useState, useEffect } from 'react';
import Splash from './screens/Splash';
import Login  from './screens/Login';
import IDE    from './screens/IDE';

type Screen = 'splash' | 'login' | 'ide';

const SPLASH_MIN_MS = 2300;

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  useEffect(() => {
    const splashStart = Date.now();

    async function bootCheck() {
      const elapsed   = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, remaining));

      try {
        const session = await window.api.auth.getSession();
        setScreen(session ? 'ide' : 'login');
      } catch {
        setScreen('login');
      }
    }

    bootCheck();
    const cleanupSetup = window.api.setup.onComplete(() => {});
    return cleanupSetup;
  }, []);

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <>
      {isMac && screen !== 'splash' && <div className="titlebar-drag" />}
      {screen === 'splash' && <Splash />}
      {screen === 'login'  && <Login onLogin={() => setScreen('ide')} />}
      {screen === 'ide'    && <IDE />}
    </>
  );
}
