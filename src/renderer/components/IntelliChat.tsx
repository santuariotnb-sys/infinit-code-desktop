import React, { useState, useRef, useEffect } from 'react';

interface IntelliChatProps {
  onSendCommand: (command: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_COMMANDS = [
  { label: 'Criar componente', cmd: 'claude "crie um componente React para "' },
  { label: 'Corrigir erro', cmd: 'claude "corrija o erro: "' },
  { label: 'Explicar codigo', cmd: 'claude "explique este codigo: "' },
  { label: 'Adicionar feature', cmd: 'claude "adicione a feature: "' },
  { label: 'Refatorar', cmd: 'claude "refatore o codigo para "' },
];

export default function IntelliChat({ onSendCommand }: IntelliChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Build claude command
    const command = `claude "${input.replace(/"/g, '\\"')}"`;
    onSendCommand(command);

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Enviado para o terminal: ${command}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleQuickCommand(cmd: string) {
    setInput(cmd.replace('claude "', '').replace('"', ''));
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>∞</span>
        <span style={styles.headerText}>IntelliChat</span>
      </div>

      <div style={styles.quickCommands}>
        {QUICK_COMMANDS.map((qc) => (
          <button
            key={qc.label}
            style={styles.quickBtn}
            onClick={() => handleQuickCommand(qc.cmd)}
          >
            {qc.label}
          </button>
        ))}
      </div>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Pergunte qualquer coisa</p>
            <p style={styles.emptyText}>
              Digite sua pergunta e o Claude vai executar no terminal.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMsg : styles.assistantMsg),
            }}
          >
            <span style={styles.msgContent}>{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Descreva o que quer fazer..."
          style={styles.input}
          rows={2}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: input.trim() ? 1 : 0.4,
          }}
          onClick={handleSend}
          disabled={!input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a2a',
  },
  headerIcon: {
    color: '#00ff88',
    fontSize: '18px',
  },
  headerText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
  },
  quickCommands: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    padding: '10px 12px',
    borderBottom: '1px solid #1a1a1a',
  },
  quickBtn: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#888',
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  emptyTitle: {
    color: '#666',
    fontSize: '14px',
    fontWeight: 500,
  },
  emptyText: {
    color: '#444',
    fontSize: '12px',
    textAlign: 'center' as const,
    lineHeight: '1.5',
  },
  message: {
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    lineHeight: '1.4',
    maxWidth: '90%',
  },
  userMsg: {
    background: 'rgba(0, 255, 136, 0.1)',
    color: '#ddd',
    alignSelf: 'flex-end',
    borderBottomRightRadius: '2px',
  },
  assistantMsg: {
    background: '#1a1a1a',
    color: '#888',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: '2px',
  },
  msgContent: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid #2a2a2a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '13px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: '1.4',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: '#00ff88',
    color: '#0a0a0a',
    border: 'none',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
