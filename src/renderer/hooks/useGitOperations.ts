import { useState, useEffect } from 'react';

interface UseGitOperationsOptions {
  projectPath: string | null;
  branch: string;
  onProgress?: (msg: string) => void;
  onRefresh?: () => Promise<void>;
  onSyncDone?: () => void;
}

export function useGitOperations({
  projectPath,
  branch,
  onProgress,
  onRefresh,
  onSyncDone,
}: UseGitOperationsOptions) {
  const [loading, setLoading] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');

  // Check auth on mount
  useEffect(() => {
    window.api.github.authStatus().then((s) => {
      setConnected(s.connected);
      if (s.user) setUsername(s.user);
    });
  }, []);

  // Listen for sync progress
  useEffect(() => {
    const cleanup = window.api.github.onSyncProgress((data: { step?: string; msg?: string }) => {
      const txt = data.msg || data.step || '';
      if (txt) {
        setSyncLog((prev) => (prev + '\n' + txt).split('\n').slice(-20).join('\n'));
        onProgress?.(txt);
      }
    });
    return cleanup;
  }, [onProgress]);

  async function handlePull() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    try {
      const result = await window.api.github.pull(projectPath, branch);
      if (!result?.ok) throw new Error('Pull falhou');
      await onRefresh?.();
      onSyncDone?.();
    } catch (err) {
      setSyncLog(`⚠ Erro no pull: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePush() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    try {
      const result = await window.api.github.push(projectPath, branch);
      if (!result?.ok) throw new Error('Push falhou');
      onSyncDone?.();
    } catch (err) {
      setSyncLog(`⚠ Erro no push: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    try {
      const result = await window.api.github.sync(projectPath, branch);
      if (!result?.pushed && !result?.conflicts) throw new Error('Sync não completou');
      await onRefresh?.();
      onSyncDone?.();
    } catch (err) {
      setSyncLog(`⚠ Erro no sync: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit(commitMsg: string, onClear: () => void): Promise<boolean> {
    if (!projectPath || !commitMsg.trim()) return false;
    setLoading(true);
    const result = await window.api.github.commit?.(projectPath, commitMsg.trim());
    if (result?.ok) {
      onClear();
      await onRefresh?.();
      setLoading(false);
      return true;
    } else {
      setSyncLog(`Erro: ${result?.error || 'falha no commit'}`);
      setLoading(false);
      return false;
    }
  }

  async function handleCreateBranch(name: string, onDone: () => void) {
    if (!projectPath || !name.trim()) return;
    const result = await window.api.github.createBranch(projectPath, name.trim());
    if (!result?.ok) {
      setSyncLog(`⚠ Erro ao criar branch: ${result?.error || 'falha desconhecida'}`);
      return;
    }
    onDone();
    await onRefresh?.();
  }

  async function handleSyncWithLovable() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    try {
      await window.api.github.sync(projectPath, branch);
      await onRefresh?.();
      onSyncDone?.();
      await window.api.shell.openExternal('https://lovable.dev');
    } catch (err) {
      setSyncLog(`⚠ Erro no sync: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    syncLog,
    connected,
    username,
    handlePull,
    handlePush,
    handleSync,
    handleCommit,
    handleCreateBranch,
    handleSyncWithLovable,
  };
}
