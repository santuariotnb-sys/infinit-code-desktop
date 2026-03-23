# Plano de Refactor — Infinit Desktop

## Objetivo
Redesenhar o fluxo e as telas para um app desktop sólido, mantendo o que já funciona e corrigindo o que está bagunçado.

---

## Fluxo novo (3 etapas limpas)

```
App.tsx
  ├─ screen: 'setup'   → Setup.tsx     (verificação + instalação)
  ├─ screen: 'license' → License.tsx   (ativação)
  └─ screen: 'ide'     → IDE.tsx       (editor principal)
```

Não muda o fluxo — muda a **qualidade interna** de cada etapa.

---

## Fase 1 — Hooks (extrair lógica do IDE.tsx)

Criar `src/renderer/hooks/`:

| Hook | Responsabilidade | State que move |
|------|-----------------|----------------|
| `useFileManager` | Abrir projeto, ler/escrever arquivos, watch | `projectPath`, `files`, `openFile`, `fileContent`, `modified` |
| `useTerminal` | Output buffer, detecção de porta, expansão | `terminalOutput`, `detectedPort`, `terminalExpanded` |
| `useGitPanel` | Badge de mudanças, status | `gitChangeCount` |
| `usePanels` | Visibilidade de todos os painéis | `showPreview`, `showChat`, `showFileTree`, `showGit` |
| `useGitHub` | OAuth status, clone mode, repos | `ghStatus`, `cloneMode`, `cloneRepos`, `cloneLoading` |

**IDE.tsx depois da Fase 1:** ~60 linhas de composição pura, sem lógica.

---

## Fase 2 — Error Boundaries

Criar `src/renderer/components/ErrorBoundary.tsx` (componente genérico).

Envolver no IDE.tsx:
```tsx
<ErrorBoundary fallback={<PanelError name="Terminal" />}>
  <Terminal ... />
</ErrorBoundary>
```

Painéis cobertos: `FileTree`, `Editor`, `Terminal`, `IntelliChat`, `GitPanel`, `Preview`

---

## Fase 3 — IPC com retorno padronizado

Todos os handlers em `src/main/ipc/` passam a retornar `{ ok, data?, error? }`.

Arquivos para atualizar:
- `terminal.ts`
- `files.ts`
- `claude.ts`
- `github.ts`
- `license.ts`

---

## Fase 4 — Setup.tsx melhorado

Problemas atuais:
- Só mostra % de progresso sem detalhe de erro
- Se Node não está instalado, mensagem vaga

Melhorias:
- Mostrar qual etapa falhou com mensagem clara
- Botão "Tentar novamente" por etapa
- Link de instalação para dependências faltando

---

## Fase 5 — Telas e visual

Após a estrutura estar limpa, redesenhar:
- Layout geral do IDE (painéis, toolbar)
- Welcome screen (quando sem projeto aberto)
- Setup com stepper visual
- License com feedback de erro claro

---

## Ordem de execução

1. [ ] Criar `hooks/useFileManager.ts`
2. [ ] Criar `hooks/useTerminal.ts`
3. [ ] Criar `hooks/useGitPanel.ts`
4. [ ] Criar `hooks/usePanels.ts`
5. [ ] Criar `hooks/useGitHub.ts`
6. [ ] Refatorar `IDE.tsx` usando os hooks
7. [ ] Criar `components/ErrorBoundary.tsx`
8. [ ] Adicionar ErrorBoundary nos painéis
9. [ ] Padronizar retorno dos IPC handlers
10. [ ] Melhorar Setup.tsx
11. [ ] Redesign visual

---

## O que NÃO muda agora

- Lógica de terminal (node-pty funciona)
- GitHub OAuth (funciona)
- Monaco editor (funciona)
- forge.config.ts / build pipeline
- License validation
