import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  onSave: () => void;
  onToggleTerminal: () => void;
  onToggleFileTree: () => void;
  onToggleChat: () => void;
  onToggleGit: () => void;
  onOpenPalette?: () => void;
  onOpenSettings?: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  onToggleTerminal,
  onToggleFileTree,
  onToggleChat,
  onToggleGit,
  onOpenPalette,
  onOpenSettings,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case 's':
          e.preventDefault();
          onSave();
          break;
        case '`':
          e.preventDefault();
          onToggleTerminal();
          break;
        case 'b':
          e.preventDefault();
          onToggleFileTree();
          break;
        case 'j':
          e.preventDefault();
          onToggleChat();
          break;
        case 'G':
          // Cmd+Shift+G
          if (e.shiftKey) {
            e.preventDefault();
            onToggleGit();
          }
          break;
        case 'k':
          e.preventDefault();
          onOpenPalette?.();
          break;
        case ',':
          e.preventDefault();
          onOpenSettings?.();
          break;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, onToggleTerminal, onToggleFileTree, onToggleChat, onToggleGit, onOpenPalette, onOpenSettings]);
}
