import { useState } from 'react';

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
