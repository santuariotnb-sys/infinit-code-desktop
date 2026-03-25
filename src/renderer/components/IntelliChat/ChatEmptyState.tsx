import React from 'react';

const D = {
  surface: '#161b22', surfaceHigh: '#21262d',
  border: 'rgba(240,246,252,0.08)', borderMed: 'rgba(240,246,252,0.14)',
  text: '#e6edf3', textMid: '#8b949e', textDim: '#484f58',
  accent: '#3fb950', accentBg: 'rgba(63,185,80,0.07)', accentBorder: 'rgba(63,185,80,0.18)',
} as const;

const QUICK_ACTIONS = [
  {
    label: 'Criar projeto',
    desc: 'Next.js · TypeScript · Supabase',
    icon: '⬡',
    inject: 'claude --dangerously-skip-permissions\r',
    delay: 'Crie um projeto Next.js 14 com TypeScript, Tailwind CSS e Supabase. Configure autenticação com Google OAuth. Crie uma landing page moderna com hero, features e pricing.\r',
  },
  {
    label: 'Analisar código',
    desc: 'Bugs · Performance · Segurança',
    icon: '◈',
    inject: 'claude --dangerously-skip-permissions\r',
    delay: 'Analise todo o código deste projeto. Liste: problemas críticos, melhorias de performance, vulnerabilidades de segurança, e oportunidades de refatoração. Seja específico com arquivos e linhas.\r',
  },
  {
    label: 'Dependências',
    desc: 'Instalar · Resolver conflitos',
    icon: '◎',
    inject: 'claude --dangerously-skip-permissions\r',
    delay: 'Analise o package.json, instale as dependências faltando, corrija versões conflitantes e configure o projeto para rodar.\r',
  },
  {
    label: 'Deploy',
    desc: 'Vercel · Build · Variáveis',
    icon: '↗',
    inject: 'claude --dangerously-skip-permissions\r',
    delay: 'Prepare este projeto para deploy na Vercel. Configure variáveis de ambiente, otimize o build, e faça o deploy.\r',
  },
];

interface ChatEmptyStateProps {
  onQuickAction: (inject: string, delay?: string) => void;
}

export default function ChatEmptyState({ onQuickAction }: ChatEmptyStateProps) {
  return (
    <div style={styles.wrap}>
      <div style={styles.logoWrap}>
        <span style={styles.logo}>∞</span>
        <p style={styles.tagline}>Claude Code no Desktop</p>
        <p style={styles.sub}>Zero API · Respostas reais · Terminal direto</p>
      </div>

      <div style={styles.grid}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            style={styles.card}
            onClick={() => onQuickAction(a.inject, a.delay)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = D.accentBorder;
              (e.currentTarget as HTMLButtonElement).style.background = D.accentBg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = D.border;
              (e.currentTarget as HTMLButtonElement).style.background = D.surface;
            }}
          >
            <span style={styles.cardIcon}>{a.icon}</span>
            <div style={styles.cardText}>
              <span style={styles.cardLabel}>{a.label}</span>
              <span style={styles.cardDesc}>{a.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '20px 16px', gap: 20, overflow: 'auto',
  },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  logo: {
    fontSize: 32, color: D.accent, lineHeight: 1,
    textShadow: `0 0 20px ${D.accentBorder}`,
    fontFamily: 'monospace',
  },
  tagline: { color: D.textMid, fontSize: 12.5, fontWeight: 600, margin: 0, marginTop: 4 },
  sub: { color: D.textDim, fontSize: 10.5, margin: 0, fontFamily: 'monospace', letterSpacing: '.02em' },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', maxWidth: 320 },
  card: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: D.surface, border: `1px solid ${D.border}`,
    borderRadius: 8, padding: '10px 12px',
    cursor: 'pointer', textAlign: 'left',
    transition: 'border-color .15s, background .15s',
    fontFamily: 'inherit',
  },
  cardIcon: { fontSize: 16, color: D.textDim, flexShrink: 0, width: 18, textAlign: 'center' },
  cardText: { display: 'flex', flexDirection: 'column', gap: 2 },
  cardLabel: { color: D.textMid, fontSize: 11.5, fontWeight: 600 },
  cardDesc: { color: D.textDim, fontSize: 9.5, fontFamily: 'monospace' },
};
