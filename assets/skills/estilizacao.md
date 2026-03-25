# Skill: Estilização e UI/UX

## Quando usar
Pedidos como: "estilizar", "melhorar visual", "design", "UI", "CSS", "bonito", "layout", "dark mode", "responsivo", "animação"

## Sistema de design padrão (Tailwind)

### Cores
```
Primária:   blue-600 (ações, links, botões principais)
Secundária: gray-600 (textos, ícones secundários)
Sucesso:    green-500
Erro:       red-500
Warning:    amber-500
Background: white / gray-50 (light) | gray-900 / gray-950 (dark)
```

### Tipografia
```
Título:     text-2xl font-bold (h1) | text-xl font-semibold (h2)
Corpo:      text-base (16px)
Secundário: text-sm text-gray-500
Micro:      text-xs text-gray-400
```

### Espaçamento (escala de 4px)
```
Dentro de cards:   p-4 (16px) ou p-6 (24px)
Entre seções:      space-y-8 ou gap-8
Entre elementos:   space-y-2 ou gap-2
Margin de página:  mx-auto max-w-7xl px-4
```

### Componentes comuns

**Botão**
```tsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg
  hover:bg-blue-700 active:bg-blue-800
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-colors text-sm font-medium">
  Ação
</button>
```

**Card**
```tsx
<div className="bg-white dark:bg-gray-800 rounded-xl border
  border-gray-200 dark:border-gray-700 p-6 shadow-sm">
  {/* conteúdo */}
</div>
```

**Input**
```tsx
<input className="w-full px-3 py-2 rounded-lg border
  border-gray-300 dark:border-gray-600
  bg-white dark:bg-gray-800
  focus:ring-2 focus:ring-blue-500 focus:border-transparent
  text-sm placeholder-gray-400" />
```

## Regras de UI/UX

- Hierarquia visual: 1 ação primária por seção, resto secundário
- Feedback imediato: hover, active, focus visíveis
- Loading states: skeleton ou spinner em toda ação assíncrona
- Empty states: ilustração + mensagem + CTA quando lista está vazia
- Contraste mínimo: 4.5:1 para texto, 3:1 para elementos grandes
- Animações sutis: transition-all duration-200 (nunca mais de 300ms)
- Dark mode: usar classes dark: do Tailwind, nunca hardcodar cores
