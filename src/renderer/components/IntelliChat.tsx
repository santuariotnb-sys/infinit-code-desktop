import React, { useState, useEffect } from 'react';
import { basename } from '../utils/path';
import { buildPrompt, estimateTokens, tokenColor, ChatContext, findRelevantPaths } from '../lib/buildPrompt';
import { parseActionCards, getSuggestions, ActionCard } from '../lib/chatUtils';
import { useChatMessages } from '../hooks/useChatMessages';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useFileAttachments } from '../hooks/useFileAttachments';
import ChatMessages from './IntelliChat/ChatMessages';
import ChatInput from './IntelliChat/ChatInput';
import ChatEmptyState from './IntelliChat/ChatEmptyState';

export interface IntelliChatProps {
  mode?: 'project' | 'research';
  projectPath: string | null;
  activeFile: { path: string; content: string } | null;
  onTerminalInject: (text: string) => void;
  terminalOutput: string;
  onOpenFile?: (path: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  projectContext?: string;
  isIndexing?: boolean;
  onReindex?: () => void;
  previewPage?: string;
  previewPort?: number | null;
}

const TOOL_LABELS: Record<string, string> = {
  read_file: '📄 Lendo',
  write_file: '✏️ Escrevendo',
  edit_file: '✏️ Editando',
  bash: '⚡ Executando',
  list_files: '📁 Listando',
  search_files: '🔍 Buscando',
  grep_search: '🔎 Pesquisando',
  web_search: '🌐 Web',
  str_replace_editor: '✏️ Editando',
  computer_use: '🖥️ Computador',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `🔧 ${name}`;
}

export default function IntelliChat({ mode = 'project', projectPath, activeFile, onTerminalInject, terminalOutput, onOpenFile, onStreamingChange, projectContext, isIndexing, onReindex, previewPage, previewPort }: IntelliChatProps) {
  const [input, setInput] = useState('');
  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showResults, setShowResults] = useState(true);
  // Pergunta de aprovação — null = ainda não respondeu, true = sim, false = não
  const [approvalMode, setApprovalMode] = useState<boolean | null>(null);
  const [activeTool, setActiveTool] = useState<{ name: string; input: unknown } | null>(null);

  const chat = useChatMessages();
  const voice = useVoiceInput({ onTranscript: (text) => setInput((prev) => prev ? `${prev} ${text}` : text) });
  const files = useFileAttachments({ projectPath, activeFile, inputValue: input, onInputChange: setInput });
  const isSendingRef = React.useRef(false); // guard contra envios simultâneos

  useEffect(() => { onStreamingChange?.(chat.isStreaming); }, [chat.isStreaming, onStreamingChange]);

  // Verifica status ao montar
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

    // Guard — não envia se já está processando
    if (isSendingRef.current) return;

    // Execução direta de comandos com ! (ex: !npm run dev)
    if (msg.startsWith('!')) {
      const cmd = msg.slice(1).trim();
      chat.addUserMessage(msg);
      setInput('');
      onTerminalInject(cmd + '\r');
      if (showResults) chat.addSystemMessage(`→ Executando: ${cmd}`);
      return;
    }

    const isResearch = mode === 'research';
    const cwd = projectPath ?? (typeof process !== 'undefined' ? process.env.HOME ?? '~' : '~');

    // ── Resolve arquivos relevantes ao pedido ─────────────────────────────────
    let relevantFiles: Array<{ path: string; content: string }> = [];
    if (!isResearch && projectContext && projectPath) {
      const paths = findRelevantPaths(msg, projectContext, projectPath, activeFile?.path);
      const reads = await Promise.allSettled(
        paths.map(async (p) => {
          const r = await window.api.files.read(p);
          return r?.ok && r.data ? { path: p, content: r.data } : null;
        })
      );
      relevantFiles = reads
        .filter((r): r is PromiseFulfilledResult<{ path: string; content: string }> =>
          r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    }

    const ctx: ChatContext = {
      cwd,
      activeFile: isResearch ? undefined : activeFile?.path,
      activeFileContent: isResearch ? undefined : activeFile?.content,
      terminalOutput: isResearch ? '' : terminalOutput.split('\n').slice(-30).join('\n'),
      projectContext: isResearch ? undefined : projectContext,
      relevantFiles: isResearch ? undefined : relevantFiles,
      history: chat.messages.filter((m) => m.role !== 'system').slice(-6).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      previewPage: isResearch ? undefined : previewPage,
      previewPort: isResearch ? undefined : previewPort,
    };

    let prompt = buildPrompt(msg, ctx);

    // Instrução de aprovação baseada na escolha do usuário
    if (approvalMode === true) {
      prompt += '\n\n[INSTRUÇÃO: Antes de cada fase de implementação, apresente um resumo do que vai fazer e aguarde aprovação explícita do usuário.]';
    } else {
      prompt += '\n\n[INSTRUÇÃO: Execute todas as tarefas diretamente sem pedir aprovação ou confirmação. Apenas faça.]';
    }
    for (const f of files.attached) {
      prompt += f.type === 'screenshot' ? `\n\n<screenshot>${f.content}</screenshot>` : `\n\n<file name="${f.name}">\n${f.content}\n</file>`;
    }

    chat.addUserMessage(msg);
    files.clearAttachments();
    setInput('');
    chat.startStreaming();
    isSendingRef.current = true;

    const removeChunk = window.api.claude.onChunk?.((data) => chat.appendChunk(data.text)) ?? (() => {});
    const removeTool  = window.api.claude.onTool?.((data) => setActiveTool(data)) ?? (() => {});
    const removeError = window.api.claude.onError?.((data) => {
      setActiveTool(null);
      chat.finishStreaming(undefined, undefined, true);
      chat.addSystemMessage(`⚠ ${data.message}`);
      isSendingRef.current = false;
    }) ?? (() => {});

    try {
      const result = await window.api.claude.ask?.({ prompt, cwd: ctx.cwd, sessionId: chat.sessionId ?? undefined });
      chat.finishStreaming(result?.cost_usd, result?.sessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      // Sempre finaliza streaming antes de mostrar erro (evita UI travada)
      chat.finishStreaming(undefined, undefined, true);
      chat.addSystemMessage(`⚠ ${message}`);
    } finally {
      removeChunk();
      removeTool();
      removeError();
      setActiveTool(null);
      isSendingRef.current = false;
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

  const QUICK_SENDS = [
    { label: 'Explique este arquivo', buildMsg: () => activeFile ? `Explique o arquivo ${activeFile.path.split('/').pop()}` : 'Explique o arquivo ativo' },
    { label: 'Crie um componente React', buildMsg: () => 'Crie um componente React com TypeScript e estilização inline' },
    { label: 'Analise os erros do terminal', buildMsg: () => 'Analise os erros presentes no terminal e sugira correções' },
    { label: 'Otimize o código', buildMsg: () => activeFile ? `Otimize o código do arquivo ${activeFile.path.split('/').pop()}` : 'Otimize o código do arquivo ativo' },
  ];

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
        <span style={styles.headerTitle}>{mode === 'research' ? 'Pesquisa' : 'IntelliChat'}</span>
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
        {projectContext && !isIndexing && (
          <button
            onClick={onReindex}
            style={{ fontSize: 9, color: '#3CB043', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', opacity: 0.7 }}
            title={`Contexto indexado (${Math.round(projectContext.length / 1000)}KB) — clique para reindexar`}
          >⊕</button>
        )}
        {isIndexing && (
          <span style={{ fontSize: 9, color: '#f0a020', fontFamily: 'monospace' }}>indexando…</span>
        )}
        <button
          onClick={() => setShowResults((v) => !v)}
          style={{ ...styles.clearBtn, color: showResults ? '#00ff88' : '#444', fontSize: 11 }}
          title={showResults ? 'Ocultar resultados' : 'Mostrar resultados'}
        >{showResults ? '◉' : '○'}</button>
        {chat.isStreaming && (
          <button
            onClick={async () => {
              await window.api.claude.cancel?.();
              setActiveTool(null);
              chat.finishStreaming(undefined, undefined, true);
              isSendingRef.current = false;
            }}
            style={{ background: 'rgba(217,48,48,0.15)', border: '1px solid rgba(217,48,48,0.4)', color: '#d93030', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace' }}
            title="Cancelar"
          >■ parar</button>
        )}
        {chat.messages.length > 0 && <button onClick={chat.clearMessages} style={styles.clearBtn} title="Nova conversa">↺</button>}
      </div>

      {/* Messages / empty state */}
      <div style={styles.messagesWrapper}>
        {isEmpty
          ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              {/* Pergunta de aprovação — só aparece uma vez por sessão */}
              {approvalMode === null && (
                <div style={styles.approvalCard}>
                  <p style={styles.approvalText}>
                    Quer que eu te passe todas as fases de construção te pedindo aprovação?
                  </p>
                  <div style={styles.approvalBtns}>
                    <button style={styles.approvalBtnYes} onClick={() => setApprovalMode(true)}>✓ Sim</button>
                    <button style={styles.approvalBtnNo} onClick={() => setApprovalMode(false)}>✗ Não</button>
                  </div>
                </div>
              )}
              <ChatEmptyState onQuickAction={(inject, delay) => { onTerminalInject(inject); if (delay) setTimeout(() => onTerminalInject(delay), 800); }} />
              <div style={styles.quickSends}>
                {QUICK_SENDS.map((qs) => (
                  <button
                    key={qs.label}
                    style={styles.quickSendBtn}
                    onClick={() => {
                      const msg = qs.buildMsg();
                      setInput(msg);
                      setTimeout(() => send(msg), 50);
                    }}
                  >
                    {qs.label}
                  </button>
                ))}
              </div>
            </div>
          )
          : <ChatMessages
            messages={showResults ? chat.messages : chat.messages.filter((m) => m.role !== 'assistant')}
            streamingText={showResults ? chat.streamingText : ''}
            actionCards={actionCards}
            onOpenFile={onOpenFile}
            onTerminalInject={onTerminalInject}
          />
        }
      </div>

      {/* Tool activity indicator */}
      {activeTool && (
        <div style={styles.toolBar}>
          <span style={styles.toolDot} />
          <span style={styles.toolLabel}>{toolLabel(activeTool.name)}</span>
          {typeof activeTool.input === 'object' && activeTool.input !== null && 'path' in activeTool.input && (
            <span style={styles.toolPath}>{String((activeTool.input as Record<string, unknown>).path ?? '').split('/').slice(-2).join('/')}</span>
          )}
          {typeof activeTool.input === 'object' && activeTool.input !== null && 'command' in activeTool.input && (
            <span style={styles.toolPath}>{String((activeTool.input as Record<string, unknown>).command ?? '').slice(0, 40)}</span>
          )}
        </div>
      )}

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
            const isRes = mode === 'research';
            const ctx: ChatContext = { cwd: projectPath ?? '~', activeFile: isRes ? undefined : activeFile?.path, activeFileContent: isRes ? undefined : activeFile?.content, terminalOutput: isRes ? '' : terminalOutput.split('\n').slice(-10).join('\n'), projectContext: isRes ? undefined : projectContext, relevantFiles: undefined, history: chat.messages.filter(m => m.role !== 'system').slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) };
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
  toolBar: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(0,255,136,0.04)', borderTop: '1px solid rgba(0,255,136,0.1)', flexShrink: 0 },
  toolDot: { width: 6, height: 6, borderRadius: '50%', background: '#00ff88', flexShrink: 0, animation: 'pulse 1s infinite' } as React.CSSProperties,
  toolLabel: { fontSize: 10, color: '#00ff88', fontFamily: 'monospace', flexShrink: 0 },
  toolPath: { fontSize: 10, color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  quickSends: { display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 12px 12px', flexShrink: 0 },
  quickSendBtn: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    color: '#888',
    borderRadius: 6,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 11,
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s',
  } as React.CSSProperties,
  approvalCard: {
    margin: '16px 12px 4px',
    background: 'rgba(0,255,136,0.04)',
    border: '1px solid rgba(0,255,136,0.15)',
    borderRadius: 8,
    padding: '14px 16px',
    flexShrink: 0,
  } as React.CSSProperties,
  approvalText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 1.5,
    margin: '0 0 12px',
  } as React.CSSProperties,
  approvalBtns: {
    display: 'flex',
    gap: 8,
  } as React.CSSProperties,
  approvalBtnYes: {
    background: 'rgba(0,255,136,0.12)',
    border: '1px solid rgba(0,255,136,0.3)',
    color: '#00ff88',
    borderRadius: 6,
    padding: '6px 18px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
  } as React.CSSProperties,
  approvalBtnNo: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #2a2a2a',
    color: '#666',
    borderRadius: 6,
    padding: '6px 18px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
};
