import React, { useState, useEffect, useRef } from 'react';
import { basename } from '../utils/path';
import { buildPrompt, estimateTokens, tokenColor, ChatContext, findRelevantPaths } from '../lib/buildPrompt';
import { parseActionCards, getSuggestions, ActionCard } from '../lib/chatUtils';
import { useChatMessages } from '../hooks/useChatMessages';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useFileAttachments } from '../hooks/useFileAttachments';
import { useSkills } from '../hooks/useSkills';
import ChatMessages from './IntelliChat/ChatMessages';
import ChatInput from './IntelliChat/ChatInput';
import ChatEmptyState from './IntelliChat/ChatEmptyState';

type AIProvider = 'claude' | 'gemini' | 'groq' | 'openrouter';

const PROVIDER_MODELS: Record<Exclude<AIProvider, 'claude'>, Array<{ id: string; label: string }>> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Flash 2.0 ⚡' },
    { id: 'gemini-2.5-pro-preview-03-25', label: 'Pro 2.5' },
    { id: 'gemini-1.5-flash', label: 'Flash 1.5' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B ⚡' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1' },
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
    { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  ],
};

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
  const [approvalMode, setApprovalMode] = useState<boolean | null>(null);
  const [activeTool, setActiveTool] = useState<{ name: string; input: unknown } | null>(null);
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'haiku' | 'opus'>('sonnet');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [selectedExtModel, setSelectedExtModel] = useState<string>('gemini-2.0-flash');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  const chat = useChatMessages();
  const voice = useVoiceInput({ onTranscript: (text) => setInput((prev) => prev ? `${prev} ${text}` : text) });
  const files = useFileAttachments({ projectPath, activeFile, inputValue: input, onInputChange: setInput });
  useSkills(projectPath); // carrega skills no boot
  const isSendingRef = useRef(false);

  // Verifica quais providers têm API key salva
  useEffect(() => {
    const providers: Array<Exclude<AIProvider, 'claude'>> = ['gemini', 'groq', 'openrouter'];
    Promise.allSettled(providers.map(async (p) => {
      const r = await (window.api as any).aiProvider?.getKey(p);
      return { p, hasKey: !!(r?.key) };
    })).then((results) => {
      const keys: Record<string, boolean> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') keys[r.value.p] = r.value.hasKey;
      }
      setSavedKeys(keys);
    });
  }, []);

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

    if (selectedProvider === 'claude') {
      // ── Fluxo Claude CLI ───────────────────────────────────────
      const removeChunk = window.api.claude.onChunk?.((data) => chat.appendChunk(data.text)) ?? (() => {});
      const removeTool  = window.api.claude.onTool?.((data) => setActiveTool(data)) ?? (() => {});
      const removeError = window.api.claude.onError?.((data) => {
        setActiveTool(null);
        chat.finishStreaming(undefined, undefined, true);
        chat.addSystemMessage(`⚠ ${data.message}`);
        isSendingRef.current = false;
      }) ?? (() => {});

      try {
        const MODEL_IDS = {
          sonnet: 'claude-sonnet-4-6',
          haiku:  'claude-haiku-4-5-20251001',
          opus:   'claude-opus-4-6',
        };
        const result = await window.api.claude.ask?.({ prompt, cwd: ctx.cwd, sessionId: chat.sessionId ?? undefined, model: MODEL_IDS[selectedModel] });
        chat.finishStreaming(result?.cost_usd, result?.sessionId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        chat.finishStreaming(undefined, undefined, true);
        chat.addSystemMessage(`⚠ ${message}`);
      } finally {
        removeChunk();
        removeTool();
        removeError();
        setActiveTool(null);
        isSendingRef.current = false;
      }
    } else {
      // ── Fluxo API externa (Gemini / Groq / OpenRouter) ─────────
      const removeChunk = (window.api as any).aiProvider?.onChunk?.((data: { text: string }) => chat.appendChunk(data.text)) ?? (() => {});
      const removeError = (window.api as any).aiProvider?.onError?.((data: { message: string }) => {
        chat.finishStreaming(undefined, undefined, true);
        chat.addSystemMessage(`⚠ ${data.message}`);
        isSendingRef.current = false;
      }) ?? (() => {});

      try {
        const history = chat.messages
          .filter(m => m.role !== 'system')
          .slice(-6)
          .map(m => ({ role: m.role as string, content: m.content }));

        const result = await (window.api as any).aiProvider?.ask({
          provider: selectedProvider,
          model: selectedExtModel,
          prompt,
          history,
        });

        if (result && !result.ok && result.error) {
          chat.finishStreaming(undefined, undefined, true);
          chat.addSystemMessage(`⚠ ${result.error}`);
        } else {
          chat.finishStreaming();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        chat.finishStreaming(undefined, undefined, true);
        chat.addSystemMessage(`⚠ ${message}`);
      } finally {
        removeChunk();
        removeError();
        setActiveTool(null);
        isSendingRef.current = false;
      }
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
      {/* ── Row 1: Identity + status ──────────────────────────────── */}
      <div style={styles.headerRow}>
        <span style={styles.logo}>∞</span>
        <span style={styles.title}>{mode === 'research' ? 'Pesquisa' : 'IntelliChat'}</span>
        <div style={styles.statusGroup}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: chat.claudeStatus === 'ready' ? D.accent
              : chat.claudeStatus === 'thinking' ? '#f0a020'
              : chat.claudeStatus === 'offline' ? D.error : D.textDim,
          }} />
          <span style={styles.statusLabel}>
            {chat.claudeStatus === 'checking' ? 'verificando' : chat.claudeStatus === 'ready' ? 'pronto'
              : chat.claudeStatus === 'thinking' ? 'pensando…' : 'offline'}
          </span>
          {chat.claudeStatus === 'offline' && selectedProvider === 'claude' && (
            <button onClick={() => onTerminalInject('claude --dangerously-skip-permissions\r')} style={styles.microBtn}>iniciar →</button>
          )}
        </div>
        <span style={styles.projectBadge}>{projectPath ? basename(projectPath) : 'sem projeto'}</span>
        {projectContext && !isIndexing && (
          <button onClick={onReindex} style={styles.microBtn} title={`${Math.round(projectContext.length / 1000)}KB — reindexar`}>⊕</button>
        )}
        {isIndexing && <span style={styles.indexingLabel}>indexando…</span>}
        <div style={{ flex: 1 }} />
        {chat.isStreaming && (
          <button
            onClick={async () => {
              if (selectedProvider === 'claude') { await window.api.claude.cancel?.(); }
              else { await (window.api as any).aiProvider?.cancel(); }
              setActiveTool(null);
              chat.finishStreaming(undefined, undefined, true);
              isSendingRef.current = false;
            }}
            style={styles.stopBtn}
          >■ parar</button>
        )}
        {chat.messages.length > 0 && (
          <button onClick={chat.clearMessages} style={styles.iconBtn} title="Nova conversa">↺</button>
        )}
      </div>

      {/* ── Row 2: Provider tabs + model + toggles ────────────────── */}
      <div style={styles.controlRow}>
        {(['claude', 'gemini', 'groq', 'openrouter'] as AIProvider[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setSelectedProvider(p);
              if (p !== 'claude') setSelectedExtModel(PROVIDER_MODELS[p as Exclude<AIProvider, 'claude'>][0].id);
              chat.clearSession();
            }}
            style={{ ...styles.provTab, ...(selectedProvider === p ? styles.provTabActive : {}) }}
            title={p === 'claude' ? 'Claude Code CLI' : `${p} ${savedKeys[p] ? '✓ configurado' : '— sem API key'}`}
          >
            {p === 'claude' ? '∞' : p === 'gemini' ? '✦' : p === 'groq' ? '⚡' : '◈'}
            {' '}{p === 'claude' ? 'Claude' : p === 'openrouter' ? 'OR' : p.charAt(0).toUpperCase() + p.slice(1)}
            {p !== 'claude' && !savedKeys[p] && <span style={{ color: D.error, marginLeft: 2, fontSize: 7 }}>●</span>}
          </button>
        ))}
        <div style={styles.divider} />
        {selectedProvider === 'claude' ? (
          <div style={styles.modelTabs}>
            {([
              { key: 'haiku',  label: 'Haiku',  title: '⚡ Rápido · Haiku 4.5' },
              { key: 'sonnet', label: 'Sonnet', title: '⚖ Equilibrado · Sonnet 4.6' },
              { key: 'opus',   label: 'Opus',   title: '🎯 Máximo · Opus 4.6' },
            ] as const).map(({ key: m, label, title }) => (
              <button
                key={m}
                onClick={() => { if (m !== selectedModel) { setSelectedModel(m); chat.clearSession(); } }}
                style={{ ...styles.modelTab, ...(selectedModel === m ? styles.modelTabActive : {}) }}
                title={title}
              >{label}</button>
            ))}
          </div>
        ) : (
          <select value={selectedExtModel} onChange={(e) => setSelectedExtModel(e.target.value)} style={styles.modelSelect}>
            {PROVIDER_MODELS[selectedProvider as Exclude<AIProvider, 'claude'>].map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setApprovalMode((prev) => prev === true ? false : true)}
          style={{ ...styles.pillBtn, ...(approvalMode === true ? styles.pillBtnWarn : {}) }}
          title={approvalMode === true ? 'Aprovação ativa' : 'Execução direta'}
        >{approvalMode === true ? '✓ aprovação' : '⚡ direto'}</button>
        <button
          onClick={() => setShowResults((v) => !v)}
          style={{ ...styles.pillBtn, ...(showResults ? styles.pillBtnOn : {}) }}
          title={showResults ? 'Ocultar respostas' : 'Mostrar respostas'}
        >{showResults ? '◉' : '○'}</button>
        {selectedProvider !== 'claude' && (
          <button
            onClick={() => {
              setShowKeyInput(v => !v);
              if (!showKeyInput) (window.api as any).aiProvider?.getKey(selectedProvider).then((r: { key: string }) => setKeyInputValue(r?.key ?? ''));
            }}
            style={{ ...styles.iconBtn, color: savedKeys[selectedProvider] ? D.accent : D.textDim }}
            title="Configurar API key"
          >⚙</button>
        )}
      </div>

      {/* ── API key input (collapsible) ───────────────────────────── */}
      {showKeyInput && selectedProvider !== 'claude' && (
        <div style={styles.keyBar}>
          <span style={styles.keyLabel}>API key · {selectedProvider}</span>
          <input
            type="password"
            value={keyInputValue}
            onChange={(e) => setKeyInputValue(e.target.value)}
            placeholder="sk-…"
            style={styles.keyInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (window.api as any).aiProvider?.saveKey(selectedProvider, keyInputValue).then(() => {
                  setSavedKeys(prev => ({ ...prev, [selectedProvider]: !!keyInputValue }));
                  setShowKeyInput(false);
                });
              }
              if (e.key === 'Escape') setShowKeyInput(false);
            }}
          />
          <button
            onClick={() => (window.api as any).aiProvider?.saveKey(selectedProvider, keyInputValue).then(() => { setSavedKeys(prev => ({ ...prev, [selectedProvider]: !!keyInputValue })); setShowKeyInput(false); })}
            style={styles.saveKeyBtn}
          >salvar</button>
        </div>
      )}

      {/* ── Messages / empty state ────────────────────────────────── */}
      <div style={styles.messagesWrapper}>
        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {approvalMode === null && (
              <div style={styles.approvalCard}>
                <p style={styles.approvalText}>Quer que eu apresente um resumo antes de cada fase e aguarde sua aprovação?</p>
                <div style={styles.approvalBtns}>
                  <button style={styles.approvalBtnYes} onClick={() => setApprovalMode(true)}>Sim, me mostre</button>
                  <button style={styles.approvalBtnNo} onClick={() => setApprovalMode(false)}>Não, execute direto</button>
                </div>
              </div>
            )}
            <ChatEmptyState onQuickAction={(inject, delay) => { onTerminalInject(inject); if (delay) setTimeout(() => onTerminalInject(delay), 800); }} />
            <div style={styles.quickSends}>
              {QUICK_SENDS.map((qs) => (
                <button
                  key={qs.label}
                  style={styles.quickSendBtn}
                  onClick={() => { const msg = qs.buildMsg(); setInput(msg); setTimeout(() => send(msg), 50); }}
                >{qs.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <ChatMessages
            messages={showResults ? chat.messages : chat.messages.filter((m) => m.role !== 'assistant')}
            streamingText={showResults ? chat.streamingText : ''}
            actionCards={actionCards}
            onOpenFile={onOpenFile}
            onTerminalInject={onTerminalInject}
          />
        )}
      </div>

      {/* ── Tool activity ─────────────────────────────────────────── */}
      {activeTool && (
        <div style={styles.toolBar}>
          <span style={styles.toolDot} />
          <span style={styles.toolName}>{toolLabel(activeTool.name)}</span>
          {typeof activeTool.input === 'object' && activeTool.input !== null && 'path' in activeTool.input && (
            <span style={styles.toolPath}>{String((activeTool.input as Record<string, unknown>).path ?? '').split('/').slice(-2).join('/')}</span>
          )}
          {typeof activeTool.input === 'object' && activeTool.input !== null && 'command' in activeTool.input && (
            <span style={styles.toolPath}>{String((activeTool.input as Record<string, unknown>).command ?? '').slice(0, 40)}</span>
          )}
        </div>
      )}

      {/* ── Suggestions ───────────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div style={styles.suggestionsBar}>
          {suggestions.map((s) => <button key={s} style={styles.suggChip} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      {/* ── @ mention dropdown ────────────────────────────────────── */}
      {files.showMentionList && (
        <div style={styles.mentionList}>
          {files.mentionFiles.map((f, i) => (
            <div key={f} style={{ ...styles.mentionItem, ...(i === files.mentionCursor ? styles.mentionActive : {}) }} onMouseDown={() => files.insertMention(f)}>
              ◈ {basename(f)}
            </div>
          ))}
        </div>
      )}

      {/* ── Token estimate ────────────────────────────────────────── */}
      {input && (
        <div style={styles.tokenBar}>
          {(() => {
            const isRes = mode === 'research';
            const ctx: ChatContext = { cwd: projectPath ?? '~', activeFile: isRes ? undefined : activeFile?.path, activeFileContent: isRes ? undefined : activeFile?.content, terminalOutput: isRes ? '' : terminalOutput.split('\n').slice(-10).join('\n'), projectContext: isRes ? undefined : projectContext, relevantFiles: undefined, history: chat.messages.filter(m => m.role !== 'system').slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })) };
            const tokens = estimateTokens(buildPrompt(input, ctx));
            const color = tokenColor(tokens);
            return (
              <>
                <span style={{ color: color === 'green' ? D.accent : color === 'yellow' ? '#f0a020' : D.error }}>~{tokens.toLocaleString()} tokens</span>
                {chat.lastCost && <span style={{ color: D.textDim }}>última: ~${chat.lastCost.toFixed(3)}</span>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Voice error ───────────────────────────────────────────── */}
      {voice.voiceError && (
        <div style={styles.voiceError}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{voice.voiceError}</span>
          <button onClick={voice.clearError} style={styles.voiceErrorClose}>×</button>
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
        analyserRef={voice.analyserRef}
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

const D = {
  bg: '#0d1117', surface: '#161b22', surfaceHigh: '#21262d',
  border: 'rgba(240,246,252,0.08)', borderMed: 'rgba(240,246,252,0.14)',
  text: '#e6edf3', textMid: '#8b949e', textDim: '#484f58',
  accent: '#3fb950', accentBg: 'rgba(63,185,80,0.07)', accentBorder: 'rgba(63,185,80,0.18)',
  error: '#f85149',
} as const;

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: D.bg, fontSize: '12px', position: 'relative',
  },
  dragOver: { outline: `2px dashed ${D.accentBorder}`, outlineOffset: '-2px', background: D.accentBg },

  // ── Row 1: header
  headerRow: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px',
    borderBottom: `1px solid ${D.border}`,
    flexShrink: 0,
    minHeight: 36,
  },
  logo: { color: D.accent, fontSize: 15, lineHeight: 1, fontFamily: 'monospace', flexShrink: 0 },
  title: { color: D.text, fontWeight: 600, fontSize: 12.5, flexShrink: 0 },
  statusGroup: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  statusLabel: { fontSize: 9.5, color: D.textDim, fontFamily: 'monospace' },
  projectBadge: { color: D.textDim, fontSize: 9.5, fontFamily: 'monospace', flexShrink: 0 },
  indexingLabel: { fontSize: 9.5, color: '#f0a020', fontFamily: 'monospace', flexShrink: 0 },
  microBtn: {
    background: 'none', border: 'none',
    color: D.accent, fontSize: 9.5,
    cursor: 'pointer', padding: '1px 3px',
    fontFamily: 'monospace',
  },
  stopBtn: {
    background: 'rgba(248,81,73,0.12)', border: `1px solid rgba(248,81,73,0.3)`,
    color: D.error, borderRadius: 5,
    padding: '2px 8px', fontSize: 9.5,
    cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0,
  },
  iconBtn: {
    background: 'none', border: 'none',
    color: D.textDim, cursor: 'pointer',
    fontSize: 13, padding: '2px 4px', lineHeight: 1, flexShrink: 0,
  },

  // ── Row 2: controls
  controlRow: {
    display: 'flex', alignItems: 'center', gap: 2,
    padding: '4px 10px',
    borderBottom: `1px solid ${D.border}`,
    background: D.bg,
    flexShrink: 0,
    minHeight: 30,
  },
  provTab: {
    background: 'none', border: '1px solid transparent',
    color: D.textDim, borderRadius: 4,
    padding: '2px 7px', fontSize: 10,
    cursor: 'pointer', fontFamily: 'monospace',
    transition: 'all .12s', flexShrink: 0,
  },
  provTabActive: {
    background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent,
  },
  divider: { width: 1, height: 14, background: D.border, margin: '0 4px', flexShrink: 0 },
  modelTabs: { display: 'flex', gap: 1, background: D.surface, borderRadius: 5, padding: 2 },
  modelTab: {
    background: 'transparent', border: '1px solid transparent',
    color: D.textDim, borderRadius: 3,
    padding: '1px 7px', fontSize: 9.5,
    cursor: 'pointer', fontFamily: 'monospace', transition: 'all .12s',
  },
  modelTabActive: {
    background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent,
  },
  modelSelect: {
    background: D.surface, border: `1px solid ${D.border}`,
    color: D.textMid, borderRadius: 4,
    padding: '2px 6px', fontSize: 10,
    fontFamily: 'monospace', cursor: 'pointer',
    outline: 'none', maxWidth: 160,
  },
  pillBtn: {
    background: 'none', border: `1px solid ${D.border}`,
    color: D.textDim, borderRadius: 4,
    padding: '2px 7px', fontSize: 9.5,
    cursor: 'pointer', fontFamily: 'monospace',
    transition: 'all .12s', flexShrink: 0,
  },
  pillBtnOn: { background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent },
  pillBtnWarn: { background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.25)', color: '#f0a020' },

  // ── Key input bar
  keyBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 10px',
    background: D.surface, borderBottom: `1px solid ${D.border}`,
    flexShrink: 0,
  },
  keyLabel: { color: D.textDim, fontSize: 9.5, fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 },
  keyInput: {
    flex: 1, background: D.surfaceHigh,
    border: `1px solid ${D.border}`, borderRadius: 4,
    padding: '3px 8px', color: D.textMid,
    fontSize: 11, outline: 'none', fontFamily: 'monospace',
  },
  saveKeyBtn: {
    background: D.accentBg, border: `1px solid ${D.accentBorder}`,
    color: D.accent, borderRadius: 4,
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0,
  },

  // ── Messages
  messagesWrapper: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },

  // ── Tool bar
  toolBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 12px',
    background: D.accentBg,
    borderTop: `1px solid ${D.accentBorder}`,
    flexShrink: 0,
  },
  toolDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: D.accent, flexShrink: 0,
    animation: 'pulse 1s infinite',
  } as React.CSSProperties,
  toolName: { fontSize: 9.5, color: D.accent, fontFamily: 'monospace', flexShrink: 0 },
  toolPath: { fontSize: 9.5, color: D.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

  // ── Suggestions
  suggestionsBar: {
    display: 'flex', flexWrap: 'wrap', gap: 4,
    padding: '5px 10px',
    borderTop: `1px solid ${D.border}`,
    flexShrink: 0,
  },
  suggChip: {
    background: D.surface, border: `1px solid ${D.border}`,
    color: D.textDim, borderRadius: 10,
    padding: '3px 10px', fontSize: 10,
    cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },

  // ── @ mention
  mentionList: {
    position: 'absolute', bottom: 90, left: 12, right: 12,
    background: D.surface, border: `1px solid ${D.borderMed}`,
    borderRadius: 6, zIndex: 50, overflow: 'hidden',
  },
  mentionItem: {
    padding: '6px 10px', cursor: 'pointer',
    fontSize: 11, color: D.textMid, fontFamily: 'monospace',
  },
  mentionActive: { background: D.accentBg, color: D.accent },

  // ── Token bar
  tokenBar: {
    display: 'flex', justifyContent: 'space-between',
    padding: '2px 12px 3px',
    fontSize: 9.5, fontFamily: 'monospace',
    borderTop: `1px solid ${D.border}`, flexShrink: 0,
  },

  // ── Voice error
  voiceError: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
    margin: '0 10px 4px',
    padding: '6px 10px',
    background: 'rgba(248,81,73,0.08)', border: `1px solid rgba(248,81,73,0.2)`,
    borderRadius: 6, fontSize: 10.5, color: D.error, lineHeight: 1.4,
  },
  voiceErrorClose: {
    background: 'none', border: 'none', color: D.error,
    cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
  },

  // ── Empty state
  quickSends: { display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 12px 12px', flexShrink: 0 },
  quickSendBtn: {
    background: D.surface, border: `1px solid ${D.border}`,
    color: D.textDim, borderRadius: 6,
    padding: '7px 12px', cursor: 'pointer',
    fontSize: 11, textAlign: 'left',
    fontFamily: 'inherit', transition: 'border-color .12s, color .12s',
  } as React.CSSProperties,
  approvalCard: {
    margin: '14px 12px 4px',
    background: D.accentBg, border: `1px solid ${D.accentBorder}`,
    borderRadius: 8, padding: '14px 16px', flexShrink: 0,
  } as React.CSSProperties,
  approvalText: { color: D.textMid, fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' } as React.CSSProperties,
  approvalBtns: { display: 'flex', gap: 8 } as React.CSSProperties,
  approvalBtnYes: {
    background: D.accentBg, border: `1px solid ${D.accentBorder}`, color: D.accent,
    borderRadius: 6, padding: '6px 16px', fontSize: 11.5,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  } as React.CSSProperties,
  approvalBtnNo: {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.border}`,
    color: D.textDim, borderRadius: 6,
    padding: '6px 16px', fontSize: 11.5,
    cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
};
