import React, { useRef, useEffect } from 'react';
import { Message } from '../../hooks/useChatMessages';
import { ActionCard } from '../../lib/chatUtils';

interface ChatMessagesProps {
  messages: Message[];
  streamingText: string;
  actionCards: ActionCard[];
  onOpenFile?: (path: string) => void;
  onTerminalInject: (text: string) => void;
}

export default function ChatMessages({
  messages,
  streamingText,
  actionCards,
  onOpenFile,
  onTerminalInject,
}: ChatMessagesProps) {
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div style={styles.messages}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            ...styles.message,
            ...(m.role === 'user' ? styles.userMsg : m.role === 'system' ? styles.systemMsg : styles.asstMsg),
          }}
        >
          {m.content}
        </div>
      ))}

      {streamingText && (
        <div style={{ ...styles.message, ...styles.asstMsg, opacity: 0.8 }}>
          {streamingText}
          <span style={{ opacity: 0.4 }}>▊</span>
        </div>
      )}

      {actionCards.map((c) => (
        <div key={c.id} style={styles.actionCard}>
          <span style={styles.actionLabel}>{c.label}</span>
          <button
            style={styles.actionBtn}
            onClick={() => {
              if (c.type === 'file') onOpenFile?.(c.value);
              else if (c.type === 'command') onTerminalInject(c.value + '\r');
              else if (c.type === 'url') window.api.shell.openExternal(c.value);
            }}
          >
            {c.type === 'file' ? 'Abrir' : c.type === 'command' ? 'Executar' : 'Abrir Preview'}
          </button>
        </div>
      ))}

      <div ref={messagesEnd} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  messages: { flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 },
  message: { padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.4, maxWidth: '92%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' },
  userMsg: { background: 'rgba(0,255,136,0.08)', color: '#ddd', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  asstMsg: { background: '#1a1a1a', color: '#888', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  systemMsg: { background: 'rgba(255,60,60,0.08)', color: '#ff8888', alignSelf: 'center', fontSize: 11, fontStyle: 'italic', borderRadius: 4, padding: '4px 8px' },
  actionCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161616', border: '1px solid #222', borderRadius: 6, padding: '6px 10px', gap: 8 },
  actionLabel: { color: '#888', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  actionBtn: { background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10, flexShrink: 0 },
};
