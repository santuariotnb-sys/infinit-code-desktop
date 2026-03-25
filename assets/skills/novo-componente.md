# Skill: Criar novo componente

## Quando usar
Pedidos como: "cria um componente", "faz um card de", "monta uma tela de", "novo componente"

## Checklist antes de codar

1. **Nome**: PascalCase, descritivo, sufixo pelo tipo (Card, List, Modal, Form, Button)
2. **Onde colocar**: `src/components/` ou subpasta por domínio
3. **Props**: tipar com interface, valores default quando faz sentido
4. **Responsividade**: mobile-first, usar Tailwind breakpoints (sm, md, lg)

## Template

```tsx
import React, { useState } from 'react';

interface NomeProps {
  // props obrigatórias
  title: string;
  // props opcionais com default
  variant?: 'primary' | 'secondary';
}

export default function Nome({ title, variant = 'primary' }: NomeProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="...">
      {/* conteúdo */}
    </div>
  );
}
```

## Regras

- Export default (1 componente por arquivo)
- Sem lógica de negócio — usar hooks pra isso
- Estados locais simples (useState) no componente
- Estados complexos/compartilhados → hook customizado
- Estilos via Tailwind classes, nunca inline style
- Acessibilidade: aria-labels em botões/inputs, alt em imagens
- Sempre ter loading e error state quando faz fetch

## Exemplo de entrega

```
Entendi: criar componente ProductCard com imagem, título, preço e botão de compra.

[código completo]

Mudanças:
- Criado src/components/ProductCard.tsx
- Props: title, price, imageUrl, onBuy

Próximo passo: importar no componente pai e passar os dados.
```
