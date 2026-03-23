import React, { useState, useRef, useEffect, useCallback } from 'react';
import { basename } from '../utils/path';

export interface IntelliChatProps {
  projectPath: string | null;
  activeFile: { path: string; content: string } | null;
  onTerminalInject: (text: string) => void;
  terminalOutput: string;
  onOpenFile?: (path: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedFile {
  name: string;
  content: string;
  type: 'file' | 'screenshot';
}

interface ActionCard {
  id: string;
  type: 'file' | 'command' | 'url';
  label: string;
  value: string;
}

// Detect Claude actions in terminal output
function parseActionCards(output: string): ActionCard[] {
  const cards: ActionCard[] = [];
  const lines = output.split('\n').slice(-40);
  for (const line of lines) {
    // File writes: "Write(path/file.tsx)" or "Edit(path/file.tsx)" or "Writing to src/..."
    const fileMatch =
      line.match(/(?:Write|Edit|Read)\(\s*["']?([^"')]+\.[a-z]{1,6})["']?\s*\)/i) ||
      line.match(/(?:Writing to|Created|Edited?|Saved?)\s+((?:src|app|pages|components|lib)\/[^\s]+|[^\s]+\.[a-z]{1,5})/i);
    if (fileMatch && fileMatch[1] && !fileMatch[1].includes('*')) {
      const fp = fileMatch[1].trim();
      cards.push({ id: fp, type: 'file', label: `📄 ${basename(fp)}`, value: fp });
    }
    // Terminal commands
    const cmdMatch = line.match(/^\s*\$\s+(.+)$/) || line.match(/Bash\(\s*["']?([^"'\n)]{3,80})["']?\s*\)/);
    if (cmdMatch && cmdMatch[1]) {
      const cmd = cmdMatch[1].trim();
      cards.push({ id: cmd, type: 'command', label: `$ ${cmd.slice(0, 50)}`, value: cmd });
    }
    // Localhost URLs
    const urlMatch = line.match(/https?:\/\/localhost:(\d{4,5})/);
    if (urlMatch) {
      cards.push({ id: urlMatch[0], type: 'url', label: `🌐 localhost:${urlMatch[1]}`, value: urlMatch[0] });
    }
  }
  // Deduplicate
  const seen = new Set<string>();
  return cards.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }).slice(0, 5);
}

function buildContext(msg: string, activeFile: { path: string; content: string } | null, terminalOutput: string): string {
  let ctx = msg;
  if (activeFile) {
    const lines = activeFile.content.split('\n').slice(0, 100).join('\n');
    ctx += `\n\n<file name="${basename(activeFile.path)}">\n${lines}\n</file>`;
  }
  const recentOut = terminalOutput.split('\n').slice(-10).join('\n');
  if (/error:|Error:/i.test(recentOut)) {
    ctx += `\n\n<terminal_errors>\n${recentOut}\n</terminal_errors>`;
  }
  return ctx;
}

const QUICK_ACTIONS = [
  { label: 'Criar projeto', icon: '⬡', inject: 'claude --dangerously-skip-permissions\r', delay: 'Crie um projeto Next.js 14 com TypeScript, Tailwind CSS e Supabase. Configure autenticação com Google OAuth. Crie uma landing page moderna com hero, features e pricing.\r' },
  { label: 'Analisar código', icon: '🔍', inject: 'claude --dangerously-skip-permissions\r', delay: 'Analise todo o código deste projeto. Liste: problemas críticos, melhorias de performance, vulnerabilidades de segurança, e oportunidades de refatoração. Seja específico com arquivos e linhas.\r' },
  { label: 'Dependências', icon: '📦', inject: 'claude --dangerously-skip-permissions\r', delay: 'Analise o package.json, instale as dependências faltando, corrija versões conflitantes e configure o projeto para rodar.\r' },
  { label: 'Deploy', icon: '🚀', inject: 'claude --dangerously-skip-permissions\r', delay: 'Prepare este projeto para deploy na Vercel. Configure variáveis de ambiente, otimize o build, e faça o deploy.\r' },
];

export default function IntelliChat({ projectPath, activeFile, onTerminalInject, terminalOutput, onOpenFile }: IntelliChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [actionCards, setActionCards] = useState<ActionCard[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionFiles, setMentionFiles] = useState<string[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionCursor, setMentionCursor] = useState(0);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Detect Claude working / done from terminal output
  useEffect(() => {
    const lines = terminalOutput.split('\n').slice(-8).join('\n');
    // Claude Code working: spinner chars, tool calls, writing files
    if (/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]|Bash\(|Read\(|Write\(|Edit\(|Glob\(|Grep\(|running tool|writing|editing|analyzing/i.test(lines)) {
      setClaudeStatus('working');
    } else if (/✓\s*(Completed|Done|Finished)|^>\s*$/m.test(lines) || /\$\s*$/.test(lines.slice(-80))) {
      // Claude returned prompt — done
      setClaudeStatus('done');
      if (statusTimer.current) clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setClaudeStatus('idle'), 3000);
    } else if (/error:|Error:|✗|failed|FAILED/i.test(lines)) {
      setClaudeStatus('error');
    }
    // Parse action cards
    setActionCards(parseActionCards(terminalOutput));
  }, [terminalOutput]);

  // Contextual suggestions based on active file + terminal
  function getSuggestions(): string[] {
    if (!activeFile) {
      if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', 'Explique o erro'];
      return [];
    }
    const ext = activeFile.path.split('.').pop() || '';
    if (['tsx', 'jsx'].includes(ext)) {
      const base = ['Adicione TypeScript types', 'Extraia componente', 'Adicione testes'];
      if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', ...base];
      if (/localhost:/i.test(terminalOutput)) return ['Analise a UI atual', 'Melhore o design', ...base];
      return base;
    }
    if (['ts', 'js'].includes(ext)) return ['Adicione tratamento de erro', 'Melhore a performance', 'Adicione validação Zod'];
    if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', 'Explique o erro', 'Mostre o stack trace'];
    return [];
  }

  function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg) return;

    // Build context
    let fullContext = buildContext(msg, activeFile, terminalOutput);

    // Append attachments
    for (const f of attached) {
      if (f.type === 'screenshot') {
        fullContext += `\n\n<screenshot>${f.content}</screenshot>`;
      } else {
        fullContext += `\n\n<file name="${f.name}">\n${f.content}\n</file>`;
      }
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: msg }]);
    setAttached([]);
    setInput('');

    onTerminalInject(fullContext + '\r');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionList) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionCursor((c) => Math.min(c + 1, mentionFiles.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionCursor((c) => Math.max(c - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionFiles[mentionCursor]); return; }
      if (e.key === 'Escape') { setShowMentionList(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const handleInputChange = useCallback(async (val: string) => {
    setInput(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx >= 0) {
      const query = val.slice(atIdx + 1).toLowerCase();
      setMentionQuery(query);
      if (projectPath) {
        try {
          const tree = await window.api.files.readDir(projectPath);
          const flat = flattenTree(tree).filter((p) => p.toLowerCase().includes(query)).slice(0, 8);
          setMentionFiles(flat);
          setShowMentionList(flat.length > 0);
          setMentionCursor(0);
        } catch { /* ignore */ }
      }
    } else {
      setShowMentionList(false);
    }
  }, [projectPath]);

  function flattenTree(nodes: { name: string; path: string; type: string; children?: { name: string; path: string; type: string }[] }[]): string[] {
    const result: string[] = [];
    function walk(items: typeof nodes) {
      for (const n of items) {
        if (n.type === 'file') result.push(n.path);
        if (n.children) walk(n.children as typeof nodes);
      }
    }
    walk(nodes);
    return result;
  }

  async function insertMention(filePath: string) {
    try {
      const content = await window.api.files.read(filePath);
      const name = basename(filePath);
      setAttached((prev) => [...prev, { name, content, type: 'file' }]);
      // Remove @query from input
      const atIdx = input.lastIndexOf('@');
      setInput(input.slice(0, atIdx));
      setShowMentionList(false);
    } catch { /* ignore */ }
  }

  function attachActiveFile() {
    if (!activeFile) return;
    const name = basename(activeFile.path);
    const lines = activeFile.content.split('\n').slice(0, 200).join('\n');
    setAttached((prev) => [...prev, { name, content: lines, type: 'file' }]);
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttached((prev) => [...prev, { name: file.name, content: ev.target?.result as string, type: 'file' }]);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function captureScreenshot() {
    try {
      const b64 = await window.api.screenshot();
      setAttached((prev) => [...prev, { name: 'screenshot.png', content: b64, type: 'screenshot' }]);
    } catch { /* ignore */ }
  }

  function runQuickAction(action: typeof QUICK_ACTIONS[0]) {
    onTerminalInject(action.inject);
    if (action.delay) {
      setTimeout(() => onTerminalInject(action.delay), 800);
    }
  }

  const suggestions = getSuggestions();
  const isEmpty = messages.length === 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>∞</span>
        <span style={styles.headerTitle}>IntelliChat</span>
        <span style={styles.projectBadge}>{projectPath ? basename(projectPath) : 'sem projeto'}</span>
      </div>

      {/* Claude status bar */}
      {claudeStatus !== 'idle' && (
        <div style={{ ...styles.statusBar, ...(claudeStatus === 'error' ? styles.statusBarError : claudeStatus === 'done' ? styles.statusBarDone : {}) }}>
          {claudeStatus === 'working' && '⟳ Claude está trabalhando...'}
          {claudeStatus === 'done' && '✓ Pronto'}
          {claudeStatus === 'error' && '⚠ Erro detectado'}
        </div>
      )}

      {/* Messages / empty state */}
      <div style={styles.messages}>
        {isEmpty ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Claude Code no Desktop</p>
            <p style={styles.emptyText}>Zero API. Respostas reais direto no terminal.</p>
            <div style={styles.quickGrid}>
              {QUICK_ACTIONS.map((a) => (
                <button key={a.label} style={styles.quickCard} onClick={() => runQuickAction(a)}>
                  <span style={styles.quickIcon}>{a.icon}</span>
                  <span style={styles.quickLabel}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ ...styles.message, ...(m.role === 'user' ? styles.userMsg : styles.asstMsg) }}>
              {m.content}
            </div>
          ))
        )}

        {/* Action cards from terminal */}
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

      {/* Contextual suggestions */}
      {suggestions.length > 0 && (
        <div style={styles.suggestions}>
          {suggestions.map((s) => (
            <button key={s} style={styles.suggestionChip} onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* Attachments */}
      {attached.length > 0 && (
        <div style={styles.attachments}>
          {attached.map((a, i) => (
            <div key={i} style={styles.attachChip}>
              {a.type === 'screenshot' ? '🖼' : '📄'} {a.name}
              <button style={styles.removeChip} onClick={() => setAttached((prev) => prev.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* @ mention dropdown */}
      {showMentionList && (
        <div style={styles.mentionList}>
          {mentionFiles.map((f, i) => (
            <div
              key={f}
              style={{ ...styles.mentionItem, ...(i === mentionCursor ? styles.mentionActive : {}) }}
              onMouseDown={() => insertMention(f)}
            >
              📄 {basename(f)}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputArea}>
        <div style={styles.inputToolbar}>
          <button style={styles.toolBtn} onClick={() => fileInputRef.current?.click()} title="Anexar arquivo">📎</button>
          <button style={styles.toolBtn} onClick={attachActiveFile} title="Arquivo ativo" disabled={!activeFile}>📁</button>
          <button style={styles.toolBtn} onClick={captureScreenshot} title="Screenshot">🖼</button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileAttach}
            accept=".ts,.tsx,.js,.jsx,.json,.md,.txt,.sql,.css,.env.example,.py,.go,.rs" />
        </div>
        <div style={styles.inputRow}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Descreva o que quer fazer... (@arquivo para mencionar)'
            style={styles.textarea}
            rows={2}
          />
          <button
            style={{ ...styles.sendBtn, opacity: input.trim() || attached.length ? 1 : 0.4 }}
            onClick={() => send()}
            disabled={!input.trim() && !attached.length}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', background: '#111', fontSize: '12px', position: 'relative' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #2a2a2a', flexShrink: 0 },
  headerIcon: { color: '#00ff88', fontSize: 16 },
  headerTitle: { color: '#fff', fontWeight: 600, fontSize: 13, flex: 1 },
  projectBadge: { color: '#444', fontSize: 10, fontFamily: 'monospace' },
  statusBar: { padding: '4px 14px', fontSize: 11, background: 'rgba(0,255,136,0.06)', color: '#00ff88', borderBottom: '1px solid #1a1a1a', flexShrink: 0 },
  statusBarError: { background: 'rgba(255,60,60,0.08)', color: '#ff6060' },
  statusBarDone: { background: 'rgba(0,255,136,0.06)', color: '#00ff88' },
  messages: { flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8 },
  emptyTitle: { color: '#555', fontSize: 13, fontWeight: 600, margin: 0 },
  emptyText: { color: '#333', fontSize: 11, textAlign: 'center', margin: 0, lineHeight: 1.5 },
  quickGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', marginTop: 8 },
  quickCard: { background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, padding: '10px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  quickIcon: { fontSize: 18 },
  quickLabel: { color: '#777', fontSize: 10, textAlign: 'center' },
  message: { padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.4, maxWidth: '92%', wordBreak: 'break-word', whiteSpace: 'pre-wrap' },
  userMsg: { background: 'rgba(0,255,136,0.08)', color: '#ddd', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  asstMsg: { background: '#1a1a1a', color: '#888', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  actionCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161616', border: '1px solid #222', borderRadius: 6, padding: '6px 10px', gap: 8 },
  actionLabel: { color: '#888', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  actionBtn: { background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 10, flexShrink: 0 },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 12px', borderTop: '1px solid #1a1a1a', flexShrink: 0 },
  suggestionChip: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#777', borderRadius: 10, padding: '3px 10px', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' },
  attachments: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px', borderTop: '1px solid #1a1a1a', flexShrink: 0 },
  attachChip: { display: 'flex', alignItems: 'center', gap: 4, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '2px 8px', fontSize: 10, color: '#888' },
  removeChip: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 },
  mentionList: { position: 'absolute', bottom: 90, left: 12, right: 12, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, zIndex: 50, overflow: 'hidden' },
  mentionItem: { padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: '#888', fontFamily: 'monospace' },
  mentionActive: { background: 'rgba(0,255,136,0.1)', color: '#00ff88' },
  inputArea: { borderTop: '1px solid #2a2a2a', flexShrink: 0 },
  inputToolbar: { display: 'flex', gap: 2, padding: '4px 10px', borderBottom: '1px solid #1a1a1a' },
  toolBtn: { background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', padding: '3px 5px', borderRadius: 4, opacity: 0.6 },
  inputRow: { display: 'flex', gap: 6, padding: '8px 10px', alignItems: 'flex-end' },
  textarea: { flex: 1, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 },
  sendBtn: { width: 34, height: 34, borderRadius: 6, background: '#00ff88', color: '#0a0a0a', border: 'none', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
