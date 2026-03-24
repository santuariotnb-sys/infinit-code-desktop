import React, { useRef } from 'react';

interface AttachedFile {
  name: string;
  content: string;
  type: 'file' | 'screenshot';
}

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onVoiceToggle: () => void;
  isVoiceSupported: boolean;
  isListening: boolean;
  isStreaming: boolean;
  attached: AttachedFile[];
  onRemoveAttachment: (index: number) => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachActiveFile: () => void;
  onScreenshot: () => void;
  hasActiveFile: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  onVoiceToggle,
  isVoiceSupported,
  isListening,
  isStreaming,
  attached,
  onRemoveAttachment,
  onFileAttach,
  onAttachActiveFile,
  onScreenshot,
  hasActiveFile,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div style={styles.inputArea}>
      {attached.length > 0 && (
        <div style={styles.attachments}>
          {attached.map((a, i) => (
            <div key={i} style={styles.attachChip}>
              {a.type === 'screenshot' ? '🖼' : '📄'} {a.name}
              <button style={styles.removeChip} onClick={() => onRemoveAttachment(i)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.inputToolbar}>
        <button style={styles.toolBtn} onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">📎</button>
        <button style={styles.toolBtn} onClick={onAttachActiveFile} title="Arquivo ativo" disabled={!hasActiveFile}>📁</button>
        <button style={styles.toolBtn} onClick={onScreenshot} title="Screenshot">🖼</button>
        {isVoiceSupported && (
          <button
            style={{ ...styles.toolBtn, ...(isListening ? styles.toolBtnActive : {}) }}
            onClick={onVoiceToggle}
            title={isListening ? 'Parar gravação' : 'Gravar voz (pt-BR)'}
          >
            🎤
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={onFileAttach}
          accept=".ts,.tsx,.js,.jsx,.json,.md,.txt,.sql,.css,.env.example,.py,.go,.rs"
        />
      </div>

      <div style={styles.inputRow}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Descreva o que quer fazer... (@arquivo para mencionar)"
          style={styles.textarea}
          rows={2}
        />
        <button
          style={{ ...styles.sendBtn, opacity: value.trim() || attached.length ? 1 : 0.4 }}
          onClick={onSend}
          disabled={(!value.trim() && !attached.length) || isStreaming}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  inputArea: { borderTop: '1px solid #2a2a2a', flexShrink: 0 },
  attachments: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px', borderBottom: '1px solid #1a1a1a' },
  attachChip: { display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '2px 8px', fontSize: 10, color: '#888' },
  removeChip: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 },
  inputToolbar: { display: 'flex', gap: 2, padding: '4px 10px', borderBottom: '1px solid #1a1a1a' },
  toolBtn: { background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', padding: '3px 5px', borderRadius: 4, opacity: 0.6 },
  toolBtnActive: { opacity: 1, background: 'rgba(0,255,136,0.15)', color: '#00ff88' },
  inputRow: { display: 'flex', gap: 6, padding: '8px 10px', alignItems: 'flex-end' },
  textarea: { flex: 1, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 },
  sendBtn: { width: 34, height: 34, borderRadius: 6, background: '#00ff88', color: '#0a0a0a', border: 'none', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
