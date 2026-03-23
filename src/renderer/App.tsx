import React, { useState, useEffect } from 'react';
import Splash from './screens/Splash';
import Setup from './screens/Setup';
import License from './screens/License';
import IDE from './screens/IDE';

type Screen = 'splash' | 'setup' | 'license' | 'ide';

const SPLASH_MIN_MS = 2500;

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');

  useEffect(() => {
    const splashStart = Date.now();

    // Verifica licença no boot — roda em paralelo com o splash mínimo
    async function bootCheck() {
      let stored: { valid: boolean } | null = null;
      try {
        stored = await window.api.license.getStored();
      } catch {
        stored = null;
      }

      // Garante tempo mínimo do splash
      const elapsed = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, remaining));

      if (stored?.valid) {
        setScreen('ide');
      } else {
        setScreen('setup');
      }
    }

    bootCheck();
  }, []);

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <>
      {isMac && screen !== 'splash' && <div className="titlebar-drag" />}
      {screen === 'splash' && <Splash />}
      {screen === 'setup' && <Setup onComplete={() => setScreen('license')} />}
      {screen === 'license' && <License onActivated={() => setScreen('ide')} />}
      {screen === 'ide' && <IDE />}
    </>
  );
}
