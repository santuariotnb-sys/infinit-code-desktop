// ── skillSystem.ts ────────────────────────────────────────────────
// Detecta automaticamente a skill certa pela mensagem e injeta no prompt.
// Funciona com qualquer IA: Claude CLI, Gemini, Groq, OpenRouter.

export interface Skill {
  id: string;
  name: string;
  content: string;
  triggers: string[];
  priority: number;
}

// ── Triggers de detecção ──────────────────────────────────────────
const SKILL_TRIGGERS: Record<string, string[]> = {
  'novo-componente': [
    'cria componente', 'criar componente', 'novo componente', 'faz um card',
    'monta um', 'componente de', 'faz uma modal', 'cria um botão',
    'cria um formulário', 'criar form', 'cria um input',
    'new component', 'create component',
  ],
  'corrigir-bug': [
    'bug', 'erro', 'error', 'não funciona', 'quebrou', 'crash',
    'consertar', 'corrigir', 'fix', 'conserta', 'tá dando',
    'undefined', 'null', 'typeerror', 'failed', 'falhou',
    'não aparece', 'não carrega', 'tela branca', 'white screen',
  ],
  'novo-ipc-handler': [
    'ipc', 'handler', 'preload', 'main process', 'electron',
    'comunicar com main', 'chamar do backend', 'novo canal',
    'ipcmain', 'ipcrenderer',
  ],
  'nova-pagina': [
    'cria página', 'criar página', 'nova página', 'nova tela',
    'landing page', 'dashboard', 'página de login', 'tela de',
    'criar tela', 'new page', 'create page',
  ],
  'supabase': [
    'supabase', 'banco de dados', 'database', 'tabela', 'table',
    'rls', 'policy', 'edge function', 'storage', 'query',
    'migration', 'auth.users',
  ],
  'estilizacao': [
    'estilo', 'estilizar', 'css', 'design', 'visual', 'ui',
    'tailwind', 'bonito', 'layout', 'responsivo', 'dark mode',
    'animação', 'cor', 'fonte', 'espaçamento', 'alinhar',
    'centralizar', 'flexbox', 'grid',
  ],
};

// ── Skill cache ───────────────────────────────────────────────────
let loadedSkills: Map<string, Skill> | null = null;

export function setLoadedSkills(skills: Map<string, Skill>): void {
  loadedSkills = skills;
}

export function getLoadedSkills(): Map<string, Skill> | null {
  return loadedSkills;
}

export function getSkillContent(skillId: string): string | null {
  return loadedSkills?.get(skillId)?.content ?? null;
}

// ── Auto-detecção ─────────────────────────────────────────────────
export function detectSkills(message: string): string[] {
  const msgLower = message.toLowerCase();
  const matched: Array<{ id: string; score: number }> = [];

  for (const [skillId, triggers] of Object.entries(SKILL_TRIGGERS)) {
    let score = 0;
    for (const trigger of triggers) {
      if (msgLower.includes(trigger)) {
        score += trigger.split(' ').length;
      }
    }
    if (score > 0) matched.push({ id: skillId, score });
  }

  return matched
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(m => m.id);
}

// ── Monta bloco de skills para o prompt ──────────────────────────
export function buildSkillBlock(message: string, manualSkillId?: string): string {
  if (!loadedSkills) return '';

  const parts: string[] = [];

  const base = getSkillContent('base');
  if (base) parts.push(`<skill name="base">\n${base}\n</skill>`);

  if (manualSkillId && manualSkillId !== 'base') {
    const manual = getSkillContent(manualSkillId);
    if (manual) {
      parts.push(`<skill name="${manualSkillId}">\n${manual}\n</skill>`);
      return parts.join('\n\n');
    }
  }

  const detected = detectSkills(message);
  for (const skillId of detected) {
    const content = getSkillContent(skillId);
    if (content) parts.push(`<skill name="${skillId}">\n${content}\n</skill>`);
  }

  return parts.join('\n\n');
}

// ── Lista skills (para UI) ────────────────────────────────────────
export function listAvailableSkills(): Array<{ id: string; name: string }> {
  if (!loadedSkills) return [];
  return Array.from(loadedSkills.values()).map(s => ({ id: s.id, name: s.name }));
}
