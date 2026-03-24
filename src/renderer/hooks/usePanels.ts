import { useState } from 'react';

export function usePanels() {
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showFileTree, setShowFileTree] = useState(true);
  const [showGit, setShowGit] = useState(false);

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
