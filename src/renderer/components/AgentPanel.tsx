import React, { useState, useCallback } from 'react';

type AgentRole = 'planner' | 'builder' | 'reviewer';
type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentState {
  role:      AgentRole;
  status:    AgentStatus;
  output:    string;
  cost:      number;
  sessionId: string | null;
}

const SKILLS: { id: string; icon: string; label: string }[] = [
  { id: 'frontend-design', icon: '🎨', label: 'Frontend' },
  { id: 'ui-ux-pro-max',   icon: '✨', label: 'UI/UX'   },
  { id: 'supabase-agent',  icon: '🗄️', label: 'Supabase' },
  { id: 'landing-page',    icon: '🚀', label: 'Landing'  },
  { id: 'code-quality',    icon: '✅', label: 'Quality'  },
];

const AGENTS: Record<AgentRole, { label: string; icon: string; color: string; prompt: string }> = {
  planner: {
    label: 'Planner',
    icon:  '🧠',
    color: '#7755cc',
    prompt: `Você é um agente de planejamento de software.
Analise a tarefa e crie um plano detalhado passo a passo.
NÃO escreva código ainda — apenas o plano.
Retorne uma lista numerada com no máximo 8 passos. Seja conciso.`,
  },
  builder: {
    label: 'Builder',
    icon:  '💻',
    color: '#2277bb',
    prompt: `Você é um agente de implementação.
Recebeu um plano aprovado. Implemente o código seguindo o plano.
Crie ou edite os arquivos necessários usando as tools disponíveis.
Confirme cada arquivo alterado.`,
  },
  reviewer: {
    label: 'Reviewer',
    icon:  '🔍',
    color: '#3CB043',
    prompt: `Você é um agente de revisão de código.
Analise o código implementado e reporte:
1. Erros de TypeScript ou sintaxe
2. console.log esquecidos
3. TODOs não resolvidos
4. Problemas de segurança óbvios
Se está tudo correto, responda apenas "✓ Aprovado".`,
  },
};

interface Props {
  projectPath: string | null;
  activeFile?: string;
  activeFileContent?: string;
}

type ChunkObject = { type?: string; result?: string; [key: string]: unknown };

function extractResult(chunks: object[]): string {
  const resultChunk = (chunks as ChunkObject[]).find((c) => c.type === 'result');
  return resultChunk?.result ?? '';
}

export default function AgentPanel({ projectPath, activeFile, activeFileContent }: Props) {
  const [task,          setTask]          = useState('');
  const [running,       setRunning]       = useState(false);
  const [expanded,      setExpanded]      = useState<AgentRole | null>(null);
  const [activeSkills,  setActiveSkills]  = useState<string[]>([]);
  const [agents, setAgents] = useState<Record<AgentRole, AgentState>>({
    planner:  { role: 'planner',  status: 'idle', output: '', cost: 0, sessionId: null },
    builder:  { role: 'builder',  status: 'idle', output: '', cost: 0, sessionId: null },
    reviewer: { role: 'reviewer', status: 'idle', output: '', cost: 0, sessionId: null },
  });

  const patch = useCallback((role: AgentRole, update: Partial<AgentState>) => {
    setAgents((prev) => ({ ...prev, [role]: { ...prev[role], ...update } }));
  }, []);

  async function runAgents() {
    if (!task.trim() || running || !window.api.claude.ask) return;
    setRunning(true);

    const cwd = projectPath ?? '~';
    const fileCtx = activeFile
      ? `\nArquivo ativo: ${activeFile}${activeFileContent ? `\n\`\`\`\n${activeFileContent.slice(0, 2000)}\n\`\`\`` : ''}`
      : '';
    const skillCtx = activeSkills.length > 0
      ? `\n\nSkills ativas: ${activeSkills.map((s) => `/${s}`).join(', ')}`
      : '';

    // Reset
    (['planner', 'builder', 'reviewer'] as AgentRole[]).forEach((r) =>
      patch(r, { status: 'idle', output: '', cost: 0, sessionId: null })
    );

    // ── FASE 1: Planner ──────────────────────────────────────────
    patch('planner', { status: 'running' });
    let plan = '';
    try {
      const res = await window.api.claude.ask({
        prompt: `${AGENTS.planner.prompt}${skillCtx}\n\nProjeto: ${cwd}${fileCtx}\n\nTarefa: ${task}`,
        cwd,
      });
      plan = extractResult(res.chunks);
      patch('planner', { status: 'done', output: plan || '(sem saída)', cost: res.cost_usd, sessionId: res.sessionId });
    } catch (err) {
      patch('planner', { status: 'error', output: String(err) });
      setRunning(false);
      return;
    }

    // ── FASE 2: Builder ──────────────────────────────────────────
    patch('builder', { status: 'running' });
    try {
      const res = await window.api.claude.ask({
        prompt: `${AGENTS.builder.prompt}${skillCtx}\n\nProjeto: ${cwd}${fileCtx}\n\nPlano aprovado:\n${plan}\n\nImplementa agora.`,
        cwd,
      });
      const out = extractResult(res.chunks);
      patch('builder', { status: 'done', output: out || 'Implementação concluída.', cost: res.cost_usd, sessionId: res.sessionId });
    } catch (err) {
      patch('builder', { status: 'error', output: String(err) });
      setRunning(false);
      return;
    }

    // ── FASE 3: Reviewer ─────────────────────────────────────────
    patch('reviewer', { status: 'running' });
    try {
      const res = await window.api.claude.ask({
        prompt: `${AGENTS.reviewer.prompt}${skillCtx}\n\nProjeto: ${cwd}${fileCtx}\n\nTarefa implementada: ${task}`,
        cwd,
      });
      const out = extractResult(res.chunks);
      patch('reviewer', { status: 'done', output: out || '✓ Aprovado.', cost: res.cost_usd, sessionId: res.sessionId });
    } catch (err) {
      patch('reviewer', { status: 'error', output: String(err) });
    }

    setRunning(false);
  }

  const totalCost = Object.values(agents).reduce((s, a) => s + a.cost, 0);

  return (
    <div style={s.wrap}>
      <style>{`@keyframes agentPulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Header */}
      <div style={s.header}>
        <span style={{ fontSize: 12, color: '#72757f', fontFamily: "'JetBrains Mono',monospace" }}>
          🤖 multi-agentes
        </span>
        {totalCost > 0 && (
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#a8aab4', marginLeft: 'auto' }}>
            ~${totalCost.toFixed(3)}
          </span>
        )}
      </div>

      {/* Task input */}
      <div style={s.inputArea}>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAgents(); }}
          placeholder="Descreva a tarefa... (⌘Enter para executar)"
          disabled={running}
          style={s.textarea}
          rows={3}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={runAgents}
            disabled={running || !task.trim()}
            style={{
              ...s.btnRun,
              background: running ? 'rgba(60,176,67,0.15)' : '#3CB043',
              color: running ? '#3CB043' : '#fff',
              opacity: !task.trim() ? 0.4 : 1,
              cursor: running || !task.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? '⟳ Executando...' : '▶ Executar agentes'}
          </button>
          {running && (
            <button
              onClick={() => setRunning(false)}
              style={s.btnStop}
              title="Os agentes concluirão a etapa atual"
            >
              ■
            </button>
          )}
        </div>
      </div>

      {/* Agent cards */}
      <div style={s.cards}>
        {(['planner', 'builder', 'reviewer'] as AgentRole[]).map((role, idx) => {
          const agent  = agents[role];
          const cfg    = AGENTS[role];
          const isOpen = expanded === role;
          const blocked =
            (role === 'builder'  && agents.planner.status  !== 'done') ||
            (role === 'reviewer' && agents.builder.status  !== 'done');

          return (
            <div
              key={role}
              style={{
                ...s.card,
                opacity:     blocked && agent.status === 'idle' ? 0.4 : 1,
                borderColor: agent.status === 'running' ? `${cfg.color}55` : 'transparent',
              }}
            >
              <div
                style={s.cardHeader}
                onClick={() => agent.output && setExpanded(isOpen ? null : role)}
              >
                {/* Status circle */}
                <div style={{
                  ...s.statusDot,
                  background:
                    agent.status === 'done'    ? 'rgba(60,176,67,0.12)' :
                    agent.status === 'running' ? `${cfg.color}20`       :
                    agent.status === 'error'   ? 'rgba(208,64,64,0.1)'  :
                    'rgba(255,255,255,0.6)',
                  animation: agent.status === 'running' ? 'agentPulse 1.5s ease-in-out infinite' : 'none',
                }}>
                  {agent.status === 'done'    ? <span style={{ color: '#3CB043', fontSize: 12 }}>✓</span> :
                   agent.status === 'error'   ? <span style={{ color: '#d04040', fontSize: 12 }}>✕</span> :
                   agent.status === 'running' ? <span style={{ fontSize: 14 }}>{cfg.icon}</span> :
                   <span style={{ fontSize: 10, color: '#a8aab4', fontFamily: 'monospace' }}>{idx + 1}</span>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 500,
                    color:
                      agent.status === 'done'    ? '#3CB043'  :
                      agent.status === 'running' ? cfg.color  :
                      agent.status === 'error'   ? '#d04040'  :
                      '#72757f',
                  }}>
                    {cfg.icon} {cfg.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#a8aab4', fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>
                    {agent.status === 'idle'    ? (blocked ? 'aguardando etapa anterior' : 'aguardando') :
                     agent.status === 'running' ? 'processando...' :
                     agent.status === 'done'    ? `concluído · $${agent.cost.toFixed(3)}` :
                     'erro'}
                  </div>
                </div>

                {agent.output && (
                  <span style={{ fontSize: 10, color: '#c8cad4' }}>{isOpen ? '▲' : '▼'}</span>
                )}
              </div>

              {isOpen && agent.output && (
                <div style={s.output}>{agent.output}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.4)',
    display: 'flex', alignItems: 'center', flexShrink: 0,
    background: 'rgba(215,218,224,0.8)',
  },
  inputArea: {
    padding: 12,
    borderBottom: '1px solid rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.65)',
    border: 'none',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12.5,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    color: '#1a1c20',
    resize: 'none' as const,
    outline: 'none',
    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 3px 10px rgba(0,0,0,0.05)',
  },
  btnRun: {
    flex: 1, border: 'none', borderRadius: 9, padding: '10px',
    fontSize: 12, fontWeight: 500,
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    transition: 'all .2s',
  },
  btnStop: {
    background: 'rgba(208,64,64,0.1)', color: '#d04040',
    border: 'none', borderRadius: 9, padding: '10px 14px',
    fontSize: 13, cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
  },
  cards: {
    flex: 1, overflow: 'auto', padding: 12,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  card: {
    background: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 0 rgba(255,255,255,0.92) inset, 0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid transparent',
    transition: 'all .2s',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', cursor: 'pointer',
  },
  statusDot: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 0 rgba(255,255,255,0.95) inset',
  },
  output: {
    margin: '0 10px 10px',
    padding: '10px 12px',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    color: '#3a3d45',
    lineHeight: 1.6,
    borderTop: '1px solid rgba(255,255,255,0.4)',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: 200,
    overflow: 'auto',
    background: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
  },
};
