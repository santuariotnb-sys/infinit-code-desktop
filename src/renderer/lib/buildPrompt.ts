export interface ChatContext {
  cwd: string;
  activeFile?: string;
  activeFileContent?: string;
  selection?: string;
  terminalOutput?: string;
  projectContext?: string;
  relevantFiles?: Array<{ path: string; content: string }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// ── Instrução de sistema ──────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `Você é um assistente de programação integrado ao IDE Infinit Code.

COMPORTAMENTO OBRIGATÓRIO:
1. ANTES de qualquer ação, responda em 2-3 linhas: "Entendi: [o que vai fazer] → [quais arquivos vai tocar]"
2. Leia arquivos COMPLETOS — nunca trabalhe com trechos ou suponha conteúdo
3. Se o usuário mencionar algo pelo nome informal (ex: "página de checkout", "botão de login"),
   identifique o arquivo correto usando a estrutura do projeto fornecida
4. Execute diretamente sem pedir confirmações técnicas
5. Após executar, mostre o que mudou e em qual arquivo
6. Responda em português brasileiro; código permanece em inglês`;

// ── Extrai paths do projectContext ────────────────────────────────────────────
export function extractProjectPaths(projectContext: string): string[] {
  const match = projectContext.match(/## Estrutura de arquivos.*?\n([\s\S]*?)(?:\n##|$)/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.endsWith('/'));
}

// ── Identifica arquivos relevantes ao pedido ──────────────────────────────────
export function findRelevantPaths(
  message: string,
  projectContext: string,
  cwd: string,
  activeFilePath?: string,
): string[] {
  const allPaths = extractProjectPaths(projectContext);
  if (!allPaths.length) return [];

  const msgLower = message.toLowerCase();
  const relevant = new Set<string>();

  // @ mentions explícitas
  for (const m of message.matchAll(/@([\w./\-]+)/g)) {
    const name = m[1].toLowerCase();
    const found = allPaths.find(p => p.toLowerCase().includes(name));
    if (found) relevant.add(`${cwd}/${found}`);
  }

  // Palavras-chave → nomes de arquivo
  const STOP = new Set([
    'fazer', 'criar', 'quero', 'para', 'como', 'esse', 'essa', 'isto', 'isso', 'mais',
    'menos', 'quando', 'onde', 'qual', 'sendo', 'pelo', 'pela', 'numa', 'with', 'that',
    'this', 'from', 'have', 'will', 'would', 'could', 'should', 'page', 'file', 'component',
    'arquivo', 'componente', 'pagina', 'função', 'function',
  ]);

  const words = (msgLower.match(/\b[\w-]{4,}\b/g) || []).filter(w => !STOP.has(w));

  for (const word of words) {
    for (const p of allPaths) {
      const filename = p.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() ?? '';
      if (filename.includes(word) || word.includes(filename)) {
        const full = `${cwd}/${p}`;
        if (full !== activeFilePath) relevant.add(full);
        if (relevant.size >= 5) break;
      }
    }
    if (relevant.size >= 5) break;
  }

  return [...relevant].slice(0, 5);
}

function hasError(output: string): boolean {
  return /error|Error|FAIL|failed|Cannot|TypeError|SyntaxError/i.test(output);
}

// ── Constrói o prompt final ───────────────────────────────────────────────────
export function buildPrompt(message: string, ctx: ChatContext): string {
  const parts: string[] = [];

  // 1. Instrução do sistema
  parts.push(SYSTEM_INSTRUCTION);

  // 2. Contexto completo do projeto (package.json, tree, rotas, env)
  if (ctx.projectContext) {
    parts.push(`<project_context>\n${ctx.projectContext}\n</project_context>`);
  }

  // 3. Arquivo ativo — conteúdo COMPLETO (não trecho)
  if (ctx.activeFile && ctx.activeFileContent) {
    parts.push(`<active_file path="${ctx.activeFile}">\n${ctx.activeFileContent}\n</active_file>`);
  }

  // 4. Arquivos relevantes identificados automaticamente
  if (ctx.relevantFiles?.length) {
    for (const f of ctx.relevantFiles) {
      parts.push(`<file path="${f.path}">\n${f.content}\n</file>`);
    }
  }

  // 5. Código selecionado no editor
  if (ctx.selection?.trim()) {
    parts.push(`Seleção atual:\n\`\`\`\n${ctx.selection.trim()}\n\`\`\``);
  }

  // 6. Erros no terminal
  if (ctx.terminalOutput && hasError(ctx.terminalOutput)) {
    const errorLines = ctx.terminalOutput
      .split('\n')
      .filter(l => /error|Error|FAIL/i.test(l))
      .slice(-10)
      .join('\n');
    if (errorLines) parts.push(`Erros no terminal:\n${errorLines}`);
  }

  // 7. Histórico de conversa (últimas 6 mensagens)
  if (ctx.history.length > 0) {
    const histSummary = ctx.history
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Claude'}: ${m.content.slice(0, 300)}`)
      .join('\n');
    parts.push(`Histórico:\n${histSummary}`);
  }

  // 8. Pedido do usuário — sempre por último
  parts.push(`PEDIDO: ${message}`);

  return parts.join('\n\n---\n\n');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tokenColor(tokens: number): 'green' | 'yellow' | 'red' {
  if (tokens < 4000) return 'green';
  if (tokens < 8000) return 'yellow';
  return 'red';
}
