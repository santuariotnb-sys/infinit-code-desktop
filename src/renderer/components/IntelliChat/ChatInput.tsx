import React, { useRef } from 'react';
import VoiceWaveform from './VoiceWaveform';

const D = {
  bg: '#0d1117', surface: '#161b22', surfaceHigh: '#21262d',
  border: 'rgba(240,246,252,0.08)', borderMed: 'rgba(240,246,252,0.14)',
  text: '#e6edf3', textMid: '#8b949e', textDim: '#484f58',
  accent: '#3fb950', accentBg: 'rgba(63,185,80,0.07)', accentBorder: 'rgba(63,185,80,0.18)',
  error: '#f85149',
} as const;

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
  analyserRef?: React.MutableRefObject<AnalyserNode | null>;
  isStreaming: boolean;
  attached: AttachedFile[];
  onRemoveAttachment: (index: number) => void;
  onFileAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachActiveFile: () => void;
  onScreenshot: () => void;
  hasActiveFile: boolean;
}

// Ícone SVG de microfone — limpo, sem emojis
function MicIcon({ active }: { active: boolean }) {
  const c = active ? D.accent : D.textDim;
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
      <rect x="4" y="0.5" width="5" height="9" rx="2.5" stroke={c} strokeWidth="1.2" fill={active ? `${D.accent}33` : 'none'} />
      <path d="M1 7C1 9.76 3.24 12 6.5 12S12 9.76 12 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6.5 12v2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      {active && (
        <>
          <style>{`@keyframes voicePulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
          <circle cx="6.5" cy="5" r="5.5" stroke={D.accent} strokeWidth="1" fill="none"
            style={{ animation: 'voicePulse 1s ease-in-out infinite' }} />
        </>
      )}
    </svg>
  );
}

export default function ChatInput({
  value, onChange, onSend, onKeyDown, onVoiceToggle,
  isVoiceSupported, isListening, analyserRef, isStreaming,
  attached, onRemoveAttachment, onFileAttach,
  onAttachActiveFile, onScreenshot, hasActiveFile,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = (value.trim().length > 0 || attached.length > 0) && !isStreaming;

  return (
    <div style={styles.wrap}>
      {/* Attachments chips */}
      {attached.length > 0 && (
        <div style={styles.chips}>
          {attached.map((a, i) => (
            <div key={i} style={styles.chip}>
              <span style={styles.chipIcon}>{a.type === 'screenshot' ? '◻' : '◈'}</span>
              <span style={styles.chipName}>{a.name}</span>
              <button style={styles.chipRemove} onClick={() => onRemoveAttachment(i)} title="Remover">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Voice waveform */}
      {analyserRef && isListening && (
        <VoiceWaveform analyserRef={analyserRef} isListening={isListening} />
      )}

      {/* Main input row */}
      <div style={styles.row}>
        {/* Tool buttons — left group */}
        <div style={styles.tools}>
          <button
            style={styles.toolBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M7 1H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5L7 1z" stroke="currentColor" strokeWidth="1.1" fill="none" />
              <path d="M7 1v4h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
          <button
            style={{ ...styles.toolBtn, opacity: hasActiveFile ? 0.75 : 0.3 }}
            onClick={onAttachActiveFile}
            title="Arquivo ativo no editor"
            disabled={!hasActiveFile}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.1" fill="none" />
              <path d="M4 6.5h5M6.5 4v5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
          <button style={styles.toolBtn} onClick={onScreenshot} title="Capturar screenshot">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
              <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.1" />
              <path d="M4.5 2.5L5.3 1h2.4l.8 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
          {isVoiceSupported && (
            <button
              style={{ ...styles.toolBtn, color: isListening ? D.accent : D.textDim }}
              onClick={onVoiceToggle}
              title={isListening ? 'Parar gravação' : 'Gravar voz (pt-BR)'}
            >
              <MicIcon active={isListening} />
            </button>
          )}
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Descreva o que quer fazer… (@arquivo para mencionar)"
          style={styles.textarea}
          rows={2}
        />

        {/* Send button */}
        <button
          style={{ ...styles.sendBtn, opacity: canSend ? 1 : 0.3 }}
          onClick={onSend}
          disabled={!canSend}
          title="Enviar (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onFileAttach}
        accept=".ts,.tsx,.js,.jsx,.json,.md,.txt,.sql,.css,.env.example,.py,.go,.rs"
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderTop: `1px solid rgba(240,246,252,0.08)`,
    flexShrink: 0,
    background: D.bg,
  },
  chips: {
    display: 'flex', flexWrap: 'wrap', gap: 4,
    padding: '6px 12px 0',
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: 8, padding: '2px 6px 2px 8px',
    fontSize: 10.5, color: D.textMid,
  },
  chipIcon: { color: D.textDim, fontSize: 10 },
  chipName: { maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chipRemove: {
    background: 'none', border: 'none', color: D.textDim,
    cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1,
    display: 'flex', alignItems: 'center',
  },

  row: {
    display: 'flex', alignItems: 'flex-end', gap: 4,
    padding: '8px 10px',
  },
  tools: { display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 2 },
  toolBtn: {
    background: 'none', border: 'none',
    color: D.textDim, cursor: 'pointer',
    padding: '4px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color .12s',
  },
  textarea: {
    flex: 1,
    background: D.surface,
    border: `1px solid ${D.border}`,
    borderRadius: 8,
    padding: '9px 12px',
    color: D.text,
    fontSize: 12.5,
    resize: 'none',
    outline: 'none',
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    lineHeight: 1.5,
    caretColor: D.accent,
  },
  sendBtn: {
    width: 34, height: 34,
    borderRadius: 8,
    background: D.accent,
    color: '#0d1117',
    border: 'none',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity .15s',
    marginBottom: 1,
  },
};
