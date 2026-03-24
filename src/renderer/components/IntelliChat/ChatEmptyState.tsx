import React from 'react';

const QUICK_ACTIONS = [
  { label: 'Criar projeto', icon: '⬡', inject: 'claude --dangerously-skip-permissions\r', delay: 'Crie um projeto Next.js 14 com TypeScript, Tailwind CSS e Supabase. Configure autenticação com Google OAuth. Crie uma landing page moderna com hero, features e pricing.\r' },
  { label: 'Analisar código', icon: '🔍', inject: 'claude --dangerously-skip-permissions\r', delay: 'Analise todo o código deste projeto. Liste: problemas críticos, melhorias de performance, vulnerabilidades de segurança, e oportunidades de refatoração. Seja específico com arquivos e linhas.\r' },
  { label: 'Dependências', icon: '📦', inject: 'claude --dangerously-skip-permissions\r', delay: 'Analise o package.json, instale as dependências faltando, corrija versões conflitantes e configure o projeto para rodar.\r' },
  { label: 'Deploy', icon: '🚀', inject: 'claude --dangerously-skip-permissions\r', delay: 'Prepare este projeto para deploy na Vercel. Configure variáveis de ambiente, otimize o build, e faça o deploy.\r' },
];

interface ChatEmptyStateProps {
  onQuickAction: (inject: string, delay?: string) => void;
}

export default function ChatEmptyState({ onQuickAction }: ChatEmptyStateProps) {
  return (
    <div style={styles.emptyState}>
      <p style={styles.emptyTitle}>Claude Code no Desktop</p>
      <p style={styles.emptyText}>Zero API. Respostas reais direto no terminal.</p>
      <div style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} style={styles.quickCard} onClick={() => onQuickAction(a.inject, a.delay)}>
            <span style={styles.quickIcon}>{a.icon}</span>
            <span style={styles.quickLabel}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8, overflow: 'auto' },
  emptyTitle: { color: '#555', fontSize: 13, fontWeight: 600, margin: 0 },
  emptyText: { color: '#333', fontSize: 11, textAlign: 'center', margin: 0, lineHeight: 1.5 },
  quickGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', marginTop: 8 },
  quickCard: { background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, padding: '10px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  quickIcon: { fontSize: 18 },
  quickLabel: { color: '#777', fontSize: 10, textAlign: 'center' },
};
