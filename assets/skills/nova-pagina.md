# Skill: Nova página ou tela

## Quando usar
Pedidos como: "cria uma página", "nova tela", "landing page", "página de login", "dashboard"

## Estrutura de uma página

```
src/
├── pages/ (ou screens/ ou app/)
│   └── NomePage.tsx        ← página principal
├── components/
│   └── NomePage/           ← componentes da página
│       ├── HeroSection.tsx
│       ├── FeatureCard.tsx
│       └── ...
└── hooks/
    └── useNomeData.ts      ← dados da página
```

## Template de página

```tsx
import React, { useState, useEffect } from 'react';
// import componentes específicos da página

interface NomePageProps {
  // props se receber de um router
}

export default function NomePage({}: NomePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // carregar dados se necessário
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      // fetch dados
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <main className="min-h-screen">
      {/* seções da página */}
    </main>
  );
}
```

## Seções comuns por tipo de página

### Landing page
1. Hero (headline + CTA + imagem)
2. Social proof (logos ou números)
3. Features (3-4 cards)
4. Como funciona (steps)
5. Pricing (se aplicável)
6. FAQ
7. CTA final
8. Footer

### Dashboard
1. Header com nome e avatar
2. Stats cards (KPIs)
3. Gráficos/tabelas
4. Lista de atividades recentes
5. Sidebar com navegação

### Página de formulário
1. Header com título e descrição
2. Formulário com validação
3. Botão submit com loading
4. Feedback de sucesso/erro

## Regras

- Mobile-first: comece pelo layout mobile
- Seções como componentes separados
- Cada seção tem max-w e padding consistente
- Cores do design system, não hardcoded
- SEO: título, meta description, headings hierárquicos
- Performance: lazy load imagens, componentes abaixo do fold
