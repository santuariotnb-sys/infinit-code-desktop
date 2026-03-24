import React, { useState, useEffect } from 'react';
import Splash from './screens/Splash';
import IDE from './screens/IDE';

type Screen = 'splash' | 'ide';

const SPLASH_MIN_MS = 2300;

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  useEffect(() => {
    const splashStart = Date.now();

    async function bootCheck() {
      const elapsed = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, remaining));
      setScreen('ide');
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
      {screen === 'ide'    && <IDE />}
    </>
  );
}
