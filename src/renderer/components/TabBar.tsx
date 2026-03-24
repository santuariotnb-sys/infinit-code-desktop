import React, { useState } from 'react';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  isModified: boolean;
}

export default function TabBar({ tabs, activeTab, onSelect, onClose, isModified }: TabBarProps) {
  const [hoverClose, setHoverClose] = useState<string | null>(null);
  const [hoverTab, setHoverTab] = useState<string | null>(null);

  return (
    <div style={styles.container}>
      <div style={styles.tabList}>
        {tabs.map((tabPath) => {
          const isActive = tabPath === activeTab;
          const name = tabPath.split('/').pop() || tabPath;
          return (
            <div
              key={tabPath}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : styles.tabInactive),
                ...(hoverTab === tabPath && !isActive ? styles.tabHover : {}),
              }}
              onClick={() => onSelect(tabPath)}
              onMouseEnter={() => setHoverTab(tabPath)}
              onMouseLeave={() => setHoverTab(null)}
            >
              {isActive && isModified && (
                <span style={styles.modifiedDot} title="Modificado" />
              )}
              <span style={{ ...styles.tabName, ...(isActive ? styles.tabNameActive : {}) }}>
                {name}
              </span>
              <button
                style={{
                  ...styles.closeBtn,
                  opacity: hoverTab === tabPath || isActive ? 1 : 0,
                  ...(hoverClose === tabPath ? styles.closeBtnHover : {}),
                }}
                onClick={(e) => { e.stopPropagation(); onClose(tabPath); }}
                onMouseEnter={() => setHoverClose(tabPath)}
                onMouseLeave={() => setHoverClose(null)}
                title="Fechar aba"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(213,216,222,0.72)',
    borderBottom: '1px solid rgba(255,255,255,0.55)',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '5px 8px 0',
    overflowX: 'auto',
    flexShrink: 0,
    minHeight: 34,
  },
  tabList: {
    display: 'flex',
    gap: 2,
    alignItems: 'flex-end',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px 6px',
    borderRadius: '7px 7px 0 0',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.12s',
    maxWidth: 180,
    minWidth: 80,
    position: 'relative',
    flexShrink: 0,
  } as React.CSSProperties,
  tabActive: {
    background: 'rgba(255,255,255,0.65)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset',
  },
  tabInactive: {
    background: 'transparent',
  },
  tabHover: {
    background: 'rgba(255,255,255,0.35)',
  },
  tabName: {
    fontSize: 11.5,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    color: '#a8aab4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  tabNameActive: {
    color: '#2a2d35',
    fontWeight: 500,
  },
  modifiedDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#3CB043',
    flexShrink: 0,
    display: 'inline-block',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    color: '#a8aab4',
    padding: '0 1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.1s',
    borderRadius: 3,
  },
  closeBtnHover: {
    color: '#3a3d45',
    background: 'rgba(0,0,0,0.1)',
  },
};
