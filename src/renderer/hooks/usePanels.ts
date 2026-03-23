import { useState, useEffect } from 'react';

export function usePanels() {
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showGit, setShowGit] = useState(false);

  // Cmd+B (file tree) e Cmd+J (chat)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'b') { e.preventDefault(); setShowFileTree((v) => !v); }
      if (mod && e.key === 'j') { e.preventDefault(); setShowChat((v) => !v); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    showPreview,
    showChat,
    showFileTree,
    showGit,
    setShowPreview,
    setShowChat,
    setShowFileTree,
    setShowGit,
    togglePreview: () => setShowPreview((v) => !v),
    toggleChat: () => setShowChat((v) => !v),
    toggleFileTree: () => setShowFileTree((v) => !v),
    toggleGit: () => setShowGit((v) => !v),
  };
}
