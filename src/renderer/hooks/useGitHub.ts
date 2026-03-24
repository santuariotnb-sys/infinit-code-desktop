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

  useEffect(() => {
    window.api.github.authStatus()
      .then((s: { connected: boolean; user?: string }) => setGhStatus(s))
      .catch(() => setGhStatus({ connected: false }));
  }, []);

  async function handleConnectGitHub() {
    try {
      await window.api.github.connectOAuth();
      const s = await window.api.github.authStatus();
      setGhStatus(s);
    } catch (error) {
      console.error('[useGitHub] connectOAuth falhou:', error);
    }
  }

  async function handleShowClone() {
    setIsCloneLoading(true);
    setCloneError(null);
    try {
      if (!ghStatus?.connected) {
        await window.api.github.connectOAuth();
        const s = await window.api.github.authStatus();
        setGhStatus(s);
        if (!s.connected) { setIsCloneLoading(false); return; }
      }
      const result = await window.api.github.listRepos();
      if (result?.error) {
        setCloneError(result.error as string);
        setCloneRepos([]);
      } else {
        setCloneRepos((result?.repos || []) as GitRepo[]);
      }
      setIsCloneMode(true);
    } catch (e) {
      setCloneError(String(e));
      setCloneRepos([]);
      setIsCloneMode(true);
    }
    setIsCloneLoading(false);
  }

  async function handleCloneRepo(repo: GitRepo) {
    setIsCloneLoading(true);
    try {
      const home = await window.api.files.getHome();
      const repoName = String(repo.name);
      const dest = `${home}/${repoName}`;
      const cloneUrl = `https://github.com/${String(repo.fullName)}.git`;
      await window.api.github.clone(cloneUrl, dest);
      setIsCloneMode(false);
      onProjectOpen(dest);
    } catch (error) {
      console.error('[useGitHub] clone falhou:', error);
    } finally {
      setIsCloneLoading(false);
    }
  }

  return {
    ghStatus,
    isCloneMode,
    cloneRepos,
    cloneError,
    isCloneLoading,
    setIsCloneMode,
    handleConnectGitHub,
    handleShowClone,
    handleCloneRepo,
  };
}
