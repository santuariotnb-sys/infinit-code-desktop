import { useState, useEffect } from 'react';

interface UseGitOperationsOptions {
  projectPath: string | null;
  branch: string;
  onProgress?: (msg: string) => void;
  onRefresh?: () => Promise<void>;
}

export function useGitOperations({
  projectPath,
  branch,
  onProgress,
  onRefresh,
}: UseGitOperationsOptions) {
  const [loading, setLoading] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');

  // Check auth on mount
  useEffect(() => {
    window.api.github.authStatus().then((s) => {
      setConnected(s.connected);
      if (s.username) setUsername(s.username);
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

  async function handleConnect() {
    setLoading(true);
    const result = await window.api.github.connectOAuth();
    setLoading(false);
    if (result.connected) {
      setConnected(true);
      setUsername(result.username || '');
    }
  }

  async function handleDisconnect() {
    await window.api.github.disconnect();
    setConnected(false);
    setUsername('');
  }

  async function handlePull() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.pull(projectPath, branch);
    await onRefresh?.();
    setLoading(false);
  }

  async function handlePush() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.push(projectPath, branch);
    setLoading(false);
  }

  async function handleSync() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.sync(projectPath, branch);
    await onRefresh?.();
    setLoading(false);
  }

  async function handleCommit(commitMsg: string, onClear: () => void) {
    if (!projectPath || !commitMsg.trim()) return;
    setLoading(true);
    await window.api.github.sync(projectPath, branch);
    onClear();
    await onRefresh?.();
    setLoading(false);
  }

  async function handleCreateBranch(name: string, onDone: () => void) {
    if (!projectPath || !name.trim()) return;
    await window.api.github.createBranch(projectPath, name.trim());
    onDone();
    await onRefresh?.();
  }

  async function handleSyncWithLovable() {
    if (!projectPath || !branch) return;
    setLoading(true);
    setSyncLog('');
    await window.api.github.sync(projectPath, branch);
    await window.api.shell.openExternal('https://lovable.dev');
    setLoading(false);
  }

  return {
    loading,
    syncLog,
    connected,
    username,
    handleConnect,
    handleDisconnect,
    handlePull,
    handlePush,
    handleSync,
    handleCommit,
    handleCreateBranch,
    handleSyncWithLovable,
  };
}
