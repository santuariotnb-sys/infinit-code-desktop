import React, { useRef, useEffect } from 'react';
import { Message } from '../../hooks/useChatMessages';
import { ActionCard } from '../../lib/chatUtils';

const D = {
  bg: '#0d1117', surface: '#161b22', surfaceHigh: '#21262d',
  border: 'rgba(240,246,252,0.08)', borderMed: 'rgba(240,246,252,0.14)',
  text: '#e6edf3', textMid: '#8b949e', textDim: '#484f58',
  accent: '#3fb950', accentBg: 'rgba(63,185,80,0.07)', accentBorder: 'rgba(63,185,80,0.18)',
  error: '#f85149', errorBg: 'rgba(248,81,73,0.06)',
} as const;

// Renderiza markdown básico: blocos de código + inline code
function renderContent(content: string): React.ReactNode {
  const blocks = content.split(/(```[\s\S]*?```)/g);
  return blocks.map((block, i) => {
    if (block.startsWith('```')) {
      const langMatch = block.match(/^```(\w*)\n?/);
      const lang = langMatch?.[1] ?? '';
      const code = block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      return (
        <div key={i} style={styles.codeBlock}>
          {lang && <span style={styles.codeLang}>{lang}</span>}
          <pre style={styles.codePre}><code>{code}</code></pre>
        </div>
      );
    }
    // Inline code e texto normal
    const parts = block.split(/(`[^`\n]+`)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('`') && part.endsWith('`') && part.length > 2
            ? <code key={j} style={styles.inlineCode}>{part.slice(1, -1)}</code>
            : part
        )}
      </span>
    );
  });
}

interface ChatMessagesProps {
  messages: Message[];
  streamingText: string;
  actionCards: ActionCard[];
  onOpenFile?: (path: string) => void;
  onTerminalInject: (text: string) => void;
}

export default function ChatMessages({ messages, streamingText, actionCards, onOpenFile, onTerminalInject }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div style={styles.container}>
      {messages.map((m) => {
        if (m.role === 'user') return (
          <div key={m.id} style={styles.userRow}>
            <div style={styles.userBubble}>{renderContent(m.content)}</div>
          </div>
        );
        if (m.role === 'system') return (
          <div key={m.id} style={styles.systemRow}>
            <span style={styles.systemMsg}>{m.content}</span>
          </div>
        );
        // assistant
        return (
          <div key={m.id} style={styles.asstRow}>
            <div style={styles.asstAvatar}>∞</div>
            <div style={styles.asstContent}>{renderContent(m.content)}</div>
          </div>
        );
      })}

      {streamingText && (
        <div style={styles.asstRow}>
          <div style={styles.asstAvatar}>∞</div>
          <div style={{ ...styles.asstContent, color: D.text }}>
            {renderContent(streamingText)}
            <span style={styles.cursor}>▊</span>
          </div>
        </div>
      )}

      {actionCards.map((c) => (
        <div key={c.id} style={styles.actionCard}>
          <span style={styles.actionLabel}>
            {c.type === 'file' ? '📄' : c.type === 'command' ? '⚡' : '🔗'} {c.label}
          </span>
          <button
            style={styles.actionBtn}
            onClick={() => {
              if (c.type === 'file') onOpenFile?.(c.value);
              else if (c.type === 'command') onTerminalInject(c.value + '\r');
              else if (c.type === 'url') window.api.shell.openExternal(c.value);
            }}
          >
            {c.type === 'file' ? 'Abrir' : c.type === 'command' ? 'Executar' : 'Ver'}
          </button>
        </div>
      ))}

      <div ref={endRef} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1, overflow: 'auto', padding: '16px 14px',
    display: 'flex', flexDirection: 'column', gap: 16,
    scrollbarWidth: 'thin',
  },

  // Usuário — direita, bubble accent
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: {
    background: D.accentBg,
    border: `1px solid ${D.accentBorder}`,
    color: D.text,
    borderRadius: '12px 12px 2px 12px',
    padding: '9px 13px',
    fontSize: 12.5,
    lineHeight: 1.55,
    maxWidth: '82%',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
  },

  // Assistente — esquerda com avatar
  asstRow: { display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '94%' },
  asstAvatar: {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    background: `linear-gradient(135deg, ${D.accent}22, ${D.accent}44)`,
    border: `1px solid ${D.accentBorder}`,
    color: D.accent, fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  asstContent: {
    color: D.textMid,
    fontSize: 12.5, lineHeight: 1.65,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
    flex: 1,
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
  },

  // Sistema — centro, discreto
  systemRow: { display: 'flex', justifyContent: 'center' },
  systemMsg: {
    color: D.textDim, fontSize: 11, fontStyle: 'italic',
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${D.border}`,
    borderRadius: 6, padding: '4px 10px',
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
  },

  // Cursor piscante
  cursor: { opacity: 0.5, animation: 'blink 1s step-end infinite' } as React.CSSProperties,

  // Blocos de código
  codeBlock: {
    background: D.surface,
    border: `1px solid ${D.border}`,
    borderRadius: 6, margin: '8px 0',
    overflow: 'hidden',
  },
  codeLang: {
    display: 'block',
    padding: '4px 10px 3px',
    fontSize: 10, color: D.textDim,
    borderBottom: `1px solid ${D.border}`,
    fontFamily: '"JetBrains Mono", monospace',
    textTransform: 'uppercase', letterSpacing: '.08em',
  },
  codePre: {
    margin: 0, padding: '10px 12px',
    fontSize: 11.5, lineHeight: 1.6,
    color: D.text,
    fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    overflow: 'auto',
    whiteSpace: 'pre',
  },
  inlineCode: {
    background: D.surfaceHigh,
    border: `1px solid ${D.border}`,
    borderRadius: 3, padding: '1px 5px',
    fontSize: '0.9em',
    fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    color: D.accent,
  },

  // Action cards
  actionCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: 8, padding: '7px 12px', gap: 8,
  },
  actionLabel: {
    color: D.textMid, fontSize: 11.5,
    fontFamily: '"JetBrains Mono", monospace',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  actionBtn: {
    background: D.accentBg, border: `1px solid ${D.accentBorder}`,
    color: D.accent, borderRadius: 5,
    padding: '3px 10px', cursor: 'pointer',
    fontSize: 11, fontWeight: 500, flexShrink: 0,
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
  },
};
