import React, { useState, useEffect } from 'react';
import Setup from './screens/Setup';
import License from './screens/License';
import IDE from './screens/IDE';

type Screen = 'setup' | 'license' | 'ide';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    // Check if setup already completed
    const cleanupComplete = window.api.setup.onComplete(() => {
      setSetupComplete(true);
      checkLicense();
    });

    return cleanupComplete;
  }, []);

  async function checkLicense() {
    try {
      const stored = await window.api.license.getStored();
      if (stored?.valid) {
        setScreen('ide');
      } else {
        setScreen('license');
      }
    } catch {
      setScreen('license');
    }
  }

  function handleSetupComplete() {
    setSetupComplete(true);
    checkLicense();
  }

  function handleLicenseActivated() {
    setScreen('ide');
  }

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <>
      {isMac && <div className="titlebar-drag" />}
      {screen === 'setup' && <Setup onComplete={handleSetupComplete} />}
      {screen === 'license' && <License onActivated={handleLicenseActivated} />}
      {screen === 'ide' && <IDE />}
    </>
  );
}
