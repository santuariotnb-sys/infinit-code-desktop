import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleFileTree: () => void;
  onToggleChat: () => void;
  onTogglePreview: () => void;
  onToggleTerminal: () => void;
  onToggleGit: () => void;
  onRunDev: () => void;
  onOpenSettings: () => void;
  onOpenFolder: () => void;
}

interface PaletteItem {
  id: string;
  icon: string;
  name: string;
  shortcut?: string;
  action: () => void;
  section: string;
}

export default function CommandPalette({
  open,
  onClose,
  onToggleFileTree,
  onToggleChat,
  onTogglePreview,
  onToggleTerminal,
  onToggleGit,
  onRunDev,
  onOpenSettings,
  onOpenFolder,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems: PaletteItem[] = [
    { id: 'files',    section: 'Painéis',      icon: '📁', name: 'Arquivos',      shortcut: '⌘B',   action: onToggleFileTree },
    { id: 'chat',     section: 'Painéis',      icon: '💬', name: 'Chat',          shortcut: '⌘J',   action: onToggleChat },
    { id: 'preview',  section: 'Painéis',      icon: '👁',  name: 'Preview',       shortcut: '⌘⇧P', action: onTogglePreview },
    { id: 'terminal', section: 'Painéis',      icon: '⌨️',  name: 'Terminal',      shortcut: '⌘`',  action: onToggleTerminal },
    { id: 'git',      section: 'GitHub',       icon: '🐙', name: 'Painel GitHub', shortcut: '⌘⇧G', action: onToggleGit },
    { id: 'rundev',   section: 'Claude Code',  icon: '▶️',  name: 'npm run dev',   shortcut: '⌘⇧D', action: onRunDev },
    { id: 'settings', section: 'App',          icon: '⚙️', name: 'Configurações', shortcut: '⌘,',  action: onOpenSettings },
    { id: 'folder',   section: 'App',          icon: '📂', name: 'Abrir Pasta',                     action: onOpenFolder },
  ];

  const filtered = query.trim() === ''
    ? allItems
    : allItems.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus input when opened, reset state when closed
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const handleExecute = useCallback((item: PaletteItem) => {
    item.action();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) handleExecute(item);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, filtered, activeIndex, handleExecute]);

  if (!open) return null;

  // Group items by section
  const sections: string[] = [];
  filtered.forEach((item) => {
    if (!sections.includes(item.section)) sections.push(item.section);
  });

  const kbdStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 9.5,
    boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset, 0 1px 3px rgba(0,0,0,0.08)',
    fontFamily: "'JetBrains Mono', monospace",
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1000,
        background: 'rgba(175,178,186,0.42)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 72,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 560,
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 1px 0 rgba(255,255,255,0.88) inset, 0 28px 70px rgba(0,0,0,0.15)',
        }}
      >
        {/* Input */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="› Comandos, arquivos, ações..."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.5)',
            outline: 'none',
            padding: '14px 16px',
            fontSize: 14,
            color: '#1a1c20',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />

        {/* Results */}
        <div style={{ padding: '5px 0', maxHeight: 340, overflowY: 'auto' }}>
          {sections.map((section, si) => {
            const sectionItems = filtered.filter((item) => item.section === section);
            return (
              <React.Fragment key={section}>
                {si > 0 && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.5)', margin: '3px 0' }} />
                )}
                <div style={{
                  padding: '3px 16px',
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#c8cad4',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {section}
                </div>
                {sectionItems.map((item) => {
                  const globalIdx = filtered.indexOf(item);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '9px 16px',
                        gap: 10,
                        cursor: 'pointer',
                        background: isActive ? 'rgba(255,255,255,0.5)' : 'transparent',
                        transition: 'all .12s',
                      }}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onClick={() => handleExecute(item)}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'rgba(255,255,255,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, flexShrink: 0,
                        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#1a1c20', fontFamily: "'DM Sans', -apple-system, sans-serif", flex: 1 }}>
                        {item.name}
                      </div>
                      {item.shortcut && (
                        <div style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>
                          <span style={kbdStyle}>{item.shortcut}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace" }}>
              Nenhum resultado
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '9px 16px',
          borderTop: '1px solid rgba(255,255,255,0.5)',
          display: 'flex',
          gap: 12,
        }}>
          {[
            { key: '↑↓', label: 'navegar' },
            { key: 'Enter', label: 'executar' },
            { key: 'Esc', label: 'fechar' },
          ].map((hint) => (
            <div key={hint.key} style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={kbdStyle}>{hint.key}</span>
              {hint.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
