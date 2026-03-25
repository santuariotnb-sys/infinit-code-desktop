import { useState, useEffect } from 'react';

interface GitRepo {
  name: unknown;
  fullName: unknown;
}

interface UseGitHubOptions {
  onProjectOpen: (path: string) => void;
}

export function useGitHub({ onProjectOpen }: UseGitHubOptions) {
  const [ghStatus, setGhStatus] = useState<{ connected: boolean; user?: string } | null>(null);
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [cloneRepos, setCloneRepos] = useState<GitRepo[]>([]);
  const [isCloneLoading, setIsCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Callback to run after auth succeeds (e.g., load repos immediately)
  const [pendingAction, setPendingAction] = useState<'clone' | null>(null);

  useEffect(() => {
    window.api.github.authStatus()
      .then((s: { connected: boolean; user?: string }) => setGhStatus(s))
      .catch(() => setGhStatus({ connected: false }));
  }, []);

  // Called by GitHubAuthModal when auth succeeds
  async function handleAuthConnected(user: string) {
    const newStatus = { connected: true, user };
    setGhStatus(newStatus);
    setShowAuthModal(false);
    if (pendingAction === 'clone') {
      setPendingAction(null);
      await loadRepos();
    }
  }

  async function loadRepos() {
    setIsCloneLoading(true);
    setCloneError(null);
    try {
      const result = await window.api.github.listRepos();
      if (result?.error) {
        setCloneError(result.error as string);
        setCloneRepos([]);
      } else {
        setCloneRepos((result?.repos || []) as GitRepo[]);
      }
    } catch (e) {
      setCloneError(String(e));
      setCloneRepos([]);
    }
    setIsCloneLoading(false);
    setIsCloneMode(true);
  }

  function handleConnectGitHub() {
    setShowAuthModal(true);
    setPendingAction(null);
  }

  async function handleShowClone() {
    if (!ghStatus?.connected) {
      setPendingAction('clone');
      setShowAuthModal(true);
      return;
    }
    await loadRepos();
  }

  async function handleCloneRepo(repo: GitRepo) {
    setIsCloneLoading(true);
    setCloneError(null);
    try {
      const home = await window.api.files.getHome();
      const repoName = String(repo.name);
      const dest = `${home}/${repoName}`;
      const cloneUrl = `https://github.com/${String(repo.fullName)}.git`;
      const result = await window.api.github.clone(cloneUrl, dest);
      if (result?.cancelled) {
        setIsCloneMode(false);
        return;
      }
      if (!result?.ok) {
        setCloneError(result?.error || 'Falha ao clonar repositório.');
        return;
      }
      setIsCloneMode(false);
      onProjectOpen(result.path ?? dest);
    } catch (error) {
      setCloneError(String(error));
    } finally {
      setIsCloneLoading(false);
    }
  }

  function handleCancelClone() {
    window.api.github.cancelClone?.();
    setIsCloneLoading(false);
    setIsCloneMode(false);
  }

  async function handleDisconnect() {
    try {
      await window.api.github.disconnect();
    } catch { /* ignora */ }
    setGhStatus({ connected: false });
  }

  return {
    ghStatus,
    isCloneMode,
    cloneRepos,
    cloneError,
    isCloneLoading,
    showAuthModal,
    setShowAuthModal,
    setIsCloneMode,
    handleConnectGitHub,
    handleShowClone,
    handleCloneRepo,
    handleCancelClone,
    handleAuthConnected,
    handleDisconnect,
  };
}
