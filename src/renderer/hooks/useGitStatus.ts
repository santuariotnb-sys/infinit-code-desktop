import { useState, useCallback, useEffect } from 'react';

interface GitChange {
  status: string;
  file: string;
}

export function useGitStatus(projectPath: string | null) {
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [localChangeCount, setLocalChangeCount] = useState(0);

  const refreshStatus = useCallback(async () => {
    if (!projectPath) return;
    const s = await window.api.github.gitStatus(projectPath);
    if (s.isRepo) {
      setBranch(s.branch);
      setChanges(s.changes);
    }
    const b = await window.api.github.branches(projectPath);
    setBranches(b.branches || []);
  }, [projectPath]);

  // Initial load when project changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Listen for local file changes and re-check git status
  useEffect(() => {
    if (!projectPath) return;
    window.api.github.watchForChanges(projectPath);
    const cleanup = window.api.github.onLocalChanges((files: string[]) => {
      setLocalChangeCount(files.length);
      refreshStatus();
    });
    return cleanup;
  }, [projectPath, refreshStatus]);

  return {
    branch,
    setBranch,
    branches,
    changes,
    localChangeCount,
    refreshStatus,
  };
}
