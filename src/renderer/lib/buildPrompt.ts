export interface ChatContext {
  cwd: string;
  activeFile?: string;
  activeFileContent?: string;
  cursorLine?: number;
  selection?: string;
  terminalOutput?: string;
  projectContext?: string; // índice completo do projeto (package.json, tree, rotas, etc.)
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const CODE_KEYWORDS = [
  'cria', 'crie', 'adiciona', 'adicione', 'corrige', 'corrija',
  'refatora', 'muda', 'mude', 'remove', 'implementa', 'implemente',
  'bug', 'erro', 'função', 'componente', 'estilo', 'style',
  'css', 'tsx', 'ts', 'js', 'html', 'fix', 'update', 'delete',
  'create', 'add', 'change', 'make', 'build', 'write', 'generate',
];

function needsCodeContext(message: string): boolean {
  const lower = message.toLowerCase();
  return CODE_KEYWORDS.some((k) => lower.includes(k));
}

function hasError(output: string): boolean {
  return /error|Error|FAIL|failed|Cannot|TypeError|SyntaxError/i.test(output);
}

export function buildPrompt(message: string, ctx: ChatContext): string {
  const parts: string[] = [];

  // Contexto completo do projeto — sempre primeiro quando disponível
  if (ctx.projectContext) {
    parts.push(`<project_context>\n${ctx.projectContext}\n</project_context>`);
  }

  if (needsCodeContext(message) && ctx.activeFile && ctx.activeFileContent) {
    const lines = ctx.activeFileContent.split('\n');
    const cursor = ctx.cursorLine ?? 0;
    const start = Math.max(0, cursor - 30);
    const end = Math.min(lines.length, cursor + 30);
    const snippet = lines.slice(start, end).join('\n');

    parts.push(`Projeto: ${ctx.cwd}`);
    parts.push(
      `Arquivo: ${ctx.activeFile} (linhas ${start + 1}–${end})\n\`\`\`\n${snippet}\n\`\`\``
    );
  }

  if (ctx.selection?.trim()) {
    parts.push(`Código selecionado:\n\`\`\`\n${ctx.selection.trim()}\n\`\`\``);
  }

  if (ctx.terminalOutput && hasError(ctx.terminalOutput)) {
    const errorLines = ctx.terminalOutput
      .split('\n')
      .filter((l) => /error|Error|FAIL/i.test(l))
      .slice(-8)
      .join('\n');
    if (errorLines) parts.push(`Erro no terminal:\n${errorLines}`);
  }

  if (ctx.history.length > 0) {
    const last = ctx.history[ctx.history.length - 1];
    const previous = ctx.history.slice(0, -1);

    if (previous.length > 0) {
      const summary = previous
        .map((m) => `${m.role === 'user' ? 'Usuário' : 'Claude'}: ${m.content.slice(0, 100)}`)
        .join('\n');
      parts.push(`Contexto anterior:\n${summary}`);
    }

    parts.push(
      `Última mensagem: ${last.role === 'user' ? 'Usuário' : 'Claude'}: ${last.content.slice(0, 300)}`
    );
  }

  parts.push(`Instrução: ${message}`);

  return parts.join('\n\n');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tokenColor(tokens: number): 'green' | 'yellow' | 'red' {
  if (tokens < 2000) return 'green';
  if (tokens < 4000) return 'yellow';
  return 'red';
}
