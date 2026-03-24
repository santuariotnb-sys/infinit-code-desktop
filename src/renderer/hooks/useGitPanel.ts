import { useState } from 'react';

// Tracks change count for toolbar badge — used by IDE.tsx
export function useGitPanel() {
  const [gitChangeCount, setGitChangeCount] = useState(0);

  function updateChangeCount(count: number) {
    setGitChangeCount(count);
  }

  return {
    gitChangeCount,
    updateChangeCount,
  };
}
