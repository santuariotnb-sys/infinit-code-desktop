export interface ChatContext {
  cwd: string;
  activeFile?: string;
  activeFileContent?: string;
  selection?: string;
  terminalOutput?: string;
  projectContext?: string;
  relevantFiles?: Array<{ path: string; content: string }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  previewPage?: string;   // rota visível no preview, ex: "/checkout"
  previewPort?: number | null; // porta do servidor, ex: 3000
}

// ── Instrução de sistema ──────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `Você é um assistente de programação integrado ao IDE Infinit Code.

O contexto do projeto abaixo contém TUDO que você precisa saber:
- Páginas existentes (o que cada uma renderiza)
- Banco de dados (tabelas, colunas, tipos)
- Edge Functions / API routes
- Sistema de auth e sessão
- Hooks customizados e o que retornam
- Componentes organizados por pasta
- Rotas com mapeamento rota → componente
- Variáveis de ambiente disponíveis

REGRA PRINCIPAL — PÁGINA DO PREVIEW:
O usuário tem um preview ao vivo do projeto. A página visível no preview é a PÁGINA-ALVO PADRÃO.
- Todo pedido sem página explicitamente especificada deve ser interpretado como referente à página atual do preview.
- Só atue em uma página diferente se o usuário nomear explicitamente outra rota ou arquivo.
- Exemplos: "adiciona um botão verde" → edita o componente da página do preview. "muda o título" → título da página do preview. "cria uma nova página /sobre" → exceção, aqui sim é uma página diferente.

COMPORTAMENTO OBRIGATÓRIO:
1. ANTES de qualquer ação, responda em 1-2 linhas: "Entendi: [o que vai fazer] → [arquivo(s) exato(s)]"
2. Use o contexto para identificar o arquivo correto:
   - Se a página do preview for /checkout → use o componente mapeado para /checkout
   - Se a página do preview for / → use a página inicial
   - "tabela de pedidos" → busca em Banco de dados
   - "edge function de pagamento" → busca em Edge Functions
3. Os arquivos necessários JÁ ESTÃO no contexto acima (tags <active_file> e <file>). NÃO use ferramentas read_file para arquivos já presentes — use diretamente o conteúdo do contexto.
4. Execute diretamente sem pedir confirmações técnicas desnecessárias
5. Após executar, confirme qual arquivo foi alterado e o que mudou
6. Responda em português brasileiro; código permanece em inglês
7. Se uma tabela do banco for relevante, mencione os campos disponíveis`;

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
    'this', 'from', 'have', 'will', 'would', 'could', 'should',
    // Removidos: 'page', 'file', 'component', 'arquivo', 'componente', 'pagina', 'função', 'function'
    // pois são sufixos válidos de nomes de arquivo (ex: CheckoutPage, useFunction, UserComponent)
  ]);

  const words = (msgLower.match(/\b[\w-]{4,}\b/g) || []).filter(w => !STOP.has(w));

  for (const word of words) {
    for (const p of allPaths) {
      const filename = p.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() ?? '';
      if (filename.includes(word) || word.includes(filename)) {
        const full = `${cwd}/${p}`;
        if (full !== activeFilePath) relevant.add(full);
        if (relevant.size >= 3) break;
      }
    }
    if (relevant.size >= 3) break;
  }

  return [...relevant].slice(0, 3);
}

function hasError(output: string): boolean {
  return /error|Error|FAIL|failed|Cannot|TypeError|SyntaxError/i.test(output);
}

// ── Constrói o prompt final ───────────────────────────────────────────────────
export function buildPrompt(message: string, ctx: ChatContext): string {
  const parts: string[] = [];

  // 1. Instrução do sistema
  parts.push(SYSTEM_INSTRUCTION);

  // 2. Página visível no preview — ALVO PADRÃO para todos os pedidos
  if (ctx.previewPage) {
    const portInfo = ctx.previewPort ? ` (localhost:${ctx.previewPort})` : '';
    parts.push(`<preview_page>
PÁGINA ATUAL NO PREVIEW: ${ctx.previewPage}${portInfo}
Esta é a página-alvo padrão. Pedidos sem página explícita se referem a ESTA página.
Use o mapeamento rota→componente do project_context para identificar o arquivo correto.
</preview_page>`);
  }

  // 3. Contexto do projeto — truncado para não explodir o prompt
  if (ctx.projectContext) {
    const MAX_CTX = 10_000;
    const ctx_trimmed = ctx.projectContext.length > MAX_CTX
      ? ctx.projectContext.slice(0, MAX_CTX) + '\n... [contexto truncado]'
      : ctx.projectContext;
    parts.push(`<project_context>\n${ctx_trimmed}\n</project_context>`);
  }

  // 4. Arquivo ativo — limitado a 400 linhas
  if (ctx.activeFile && ctx.activeFileContent) {
    const lines = ctx.activeFileContent.split('\n');
    const content = lines.length > 400
      ? lines.slice(0, 400).join('\n') + '\n... [arquivo truncado em 400 linhas]'
      : ctx.activeFileContent;
    parts.push(`<active_file path="${ctx.activeFile}">\n${content}\n</active_file>`);
  }

  // 4. Arquivos relevantes — máx 3 arquivos, 150 linhas cada
  if (ctx.relevantFiles?.length) {
    for (const f of ctx.relevantFiles.slice(0, 3)) {
      const lines = f.content.split('\n');
      const content = lines.length > 150
        ? lines.slice(0, 150).join('\n') + '\n... [truncado]'
        : f.content;
      parts.push(`<file path="${f.path}">\n${content}\n</file>`);
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
