import React, { useState, useEffect } from 'react';
import { basename } from '../utils/path';
import { buildPrompt, estimateTokens, tokenColor, ChatContext } from '../lib/buildPrompt';
import { parseActionCards, getSuggestions, ActionCard } from '../lib/chatUtils';
import { useChatMessages } from '../hooks/useChatMessages';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useFileAttachments } from '../hooks/useFileAttachments';
import ChatMessages from './IntelliChat/ChatMessages';
import ChatInput from './IntelliChat/ChatInput';
import ChatEmptyState from './IntelliChat/ChatEmptyState';

export interface IntelliChatProps {
  projectPath: string | null;
  activeFile: { path: string; content: string } | null;
  onTerminalInject: (text: string) => void;
  terminalOutput: string;
  onOpenFile?: (path: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
}

export default function IntelliChat({ projectPath, activeFile, onTerminalInject, terminalOutput, onOpenFile, onStreamingChange }: IntelliChatProps) {
  const [input, setInput] = useState('');
  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const chat = useChatMessages();
  const voice = useVoiceInput({ onTranscript: (text) => setInput((prev) => prev ? `${prev} ${text}` : text) });
  const files = useFileAttachments({ projectPath, activeFile, inputValue: input, onInputChange: setInput });

  useEffect(() => { onStreamingChange?.(chat.isStreaming); }, [chat.isStreaming, onStreamingChange]);

  useEffect(() => {
    window.api.claude.status?.().then((s) => {
      chat.setClaudeStatus(s.installed ? 'ready' : 'offline');
    }).catch(() => chat.setClaudeStatus('offline'));
  }, []);

  useEffect(() => {
    setActionCards(parseActionCards(terminalOutput));
    const lastLines = terminalOutput.split('\n').slice(-5).join('\n');
    if (lastLines.includes('claude>') || lastLines.includes('Claude Code')) {
      chat.setClaudeStatus((prev) => prev === 'offline' ? 'ready' : prev);
    }
  }, [terminalOutput]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg) return;

    if (chat.claudeStatus === 'offline') {
      chat.addSystemMessage('Claude Code não encontrado. Inicie no terminal primeiro.');
      return;
    }

    const ctx: ChatContext = {
      cwd: projectPath ?? (typeof process !== 'undefined' ? process.env.HOME ?? '~' : '~'),
      activeFile: activeFile?.path,
      activeFileContent: activeFile?.content,
      terminalOutput: terminalOutput.split('\n').slice(-30).join('\n'),
      history: chat.messages.filter((m) => m.role !== 'system').slice(-6).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    };

    let prompt = buildPrompt(msg, ctx);
    for (const f of files.attached) {
      prompt += f.type === 'screenshot' ? `\n\n<screenshot>${f.content}</screenshot>` : `\n\n<file name="${f.name}">\n${f.content}\n</file>`;
    }

    chat.addUserMessage(msg);
    files.clearAttachments();
    setInput('');
    chat.startStreaming();

    const removeChunk = window.api.claude.onChunk?.((data) => chat.appendChunk(data.text)) ?? (() => {});
    const removeTool = window.api.claude.onTool?.(() => {}) ?? (() => {});

    try {
      const result = await window.api.claude.ask?.({ prompt, cwd: ctx.cwd, sessionId: chat.sessionId ?? undefined });
      chat.finishStreaming(result?.cost_usd, result?.sessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      chat.addSystemMessage(`Erro: ${message}`);
      chat.setClaudeStatus(message.includes('não encontrado') ? 'offline' : 'ready');
    } finally {
      removeChunk();
      removeTool();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (files.showMentionList) {
      if (e.key === 'ArrowDown') { e.preventDefault(); files.setMentionCursor((c) => Math.min(c + 1, files.mentionFiles.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); files.setMentionCursor((c) => Math.max(c - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); files.insertMention(files.mentionFiles[files.mentionCursor]); return; }
      if (e.key === 'Escape') { files.setShowMentionList(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const suggestions = getSuggestions(activeFile, terminalOutput);
  const isEmpty = chat.messages.length === 0;

  return (
    <div
      style={{ ...styles.container, ...(isDragOver ? styles.dragOver : {}) }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        const TEXT_EXTS = /\.(ts|tsx|js|jsx|json|md|txt|sql|css|py|go|rs|env|yaml|yml|toml|sh|html|xml|csv)$/i;
        for (const file of droppedFiles) {
          if (!TEXT_EXTS.test(file.name)) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            files.addAttachment({ name: file.name, content: ev.target?.result as string, type: 'file' });
          };
          reader.readAsText(file);
        }
      }}
    >
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>∞</span>
        <span style={styles.headerTitle}>IntelliChat</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: chat.claudeStatus === 'ready' ? '#3CB043' : chat.claudeStatus === 'thinking' ? '#f0a020' : chat.claudeStatus === 'offline' ? '#d93030' : '#a8aab4', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>
            {chat.claudeStatus === 'checking' ? 'Verificando...' : chat.claudeStatus === 'ready' ? 'pronto' : chat.claudeStatus === 'thinking' ? 'pensando...' : 'offline'}
          </span>
          {chat.claudeStatus === 'offline' && (
            <button onClick={() => onTerminalInject('claude --dangerously-skip-permissions\r')} style={{ fontSize: 9, color: '#3CB043', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>iniciar →</button>
          )}
        </div>
        <span style={styles.projectBadge}>{projectPath ? basename(projectPath) : 'sem projeto'}</span>
        {chat.messages.length > 0 && <button onClick={chat.clearMessages} style={styles.clearBtn} title="Nova conversa">↺</button>}
      </div>

      {/* Messages / empty state */}
      <div style={styles.messagesWrapper}>
        {isEmpty
          ? <ChatEmptyState onQuickAction={(inject, delay) => { onTerminalInject(inject); if (delay) setTimeout(() => onTerminalInject(delay), 800); }} />
          : <ChatMessages messages={chat.messages} streamingText={chat.streamingText} actionCards={actionCards} onOpenFile={onOpenFile} onTerminalInject={onTerminalInject} />
        }
      </div>

      {/* Contextual suggestions */}
      {suggestions.length > 0 && (
        <div style={styles.suggestions}>
          {suggestions.map((s) => <button key={s} style={styles.suggestionChip} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      {/* @ mention dropdown */}
      {files.showMentionList && (
        <div style={styles.mentionList}>
          {files.mentionFiles.map((f, i) => (
            <div key={f} style={{ ...styles.mentionItem, ...(i === files.mentionCursor ? styles.mentionActive : {}) }} onMouseDown={() => files.insertMention(f)}>
              📄 {basename(f)}
            </div>
          ))}
        </div>
      )}

      {/* Token count */}
      {input && (
        <div style={styles.tokenBar}>
          {(() => {
            const ctx: ChatContext = { cwd: projectPath ?? '~', activeFile: activeFile?.path, activeFileContent: activeFile?.content, terminalOutput: terminalOutput.split('\n').slice(-10).join('\n'), history: chat.messages.filter(m => m.role !== 'system').slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) };
            const tokens = estimateTokens(buildPrompt(input, ctx));
            const color = tokenColor(tokens);
            return (
              <>
                <span style={{ color: color === 'green' ? '#3CB043' : color === 'yellow' ? '#f0a020' : '#d93030' }}>~{tokens.toLocaleString()} tokens</span>
                {chat.lastCost && <span style={{ color: '#555' }}>última: ~${chat.lastCost.toFixed(3)}</span>}
              </>
            );
          })()}
        </div>
      )}

      <ChatInput
        value={input}
        onChange={files.handleInputChange}
        onSend={send}
        onKeyDown={handleKeyDown}
        onVoiceToggle={voice.handleVoiceToggle}
        isVoiceSupported={voice.isSupported}
        isListening={voice.isListening}
        isStreaming={chat.isStreaming}
        attached={files.attached}
        onRemoveAttachment={files.removeAttachment}
        onFileAttach={files.handleFileAttach}
        onAttachActiveFile={files.attachActiveFile}
        onScreenshot={files.captureScreenshot}
        hasActiveFile={Boolean(activeFile)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', background: '#111', fontSize: '12px', position: 'relative' },
  dragOver: { outline: '2px dashed rgba(0,255,136,0.4)', outlineOffset: '-2px', background: 'rgba(0,255,136,0.03)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #2a2a2a', flexShrink: 0 },
  headerIcon: { color: '#00ff88', fontSize: 16 },
  headerTitle: { color: '#fff', fontWeight: 600, fontSize: 13, flex: 1 },
  projectBadge: { color: '#444', fontSize: 10, fontFamily: 'monospace' },
  messagesWrapper: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 12px', borderTop: '1px solid #1a1a1a', flexShrink: 0 },
  suggestionChip: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#777', borderRadius: 10, padding: '3px 10px', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' },
  mentionList: { position: 'absolute', bottom: 90, left: 12, right: 12, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, zIndex: 50, overflow: 'hidden' },
  mentionItem: { padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: '#888', fontFamily: 'monospace' },
  mentionActive: { background: 'rgba(0,255,136,0.1)', color: '#00ff88' },
  tokenBar: { display: 'flex', justifyContent: 'space-between', padding: '2px 14px 4px', fontSize: 10, fontFamily: 'monospace', borderTop: '1px solid #1a1a1a', flexShrink: 0 },
  clearBtn: { background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 },
};
