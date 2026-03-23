# AUDITORIA TÉCNICA — Infinit Desktop
**Data:** 2026-03-23
**Auditor:** Claude Code (análise estática, sem execução)
**Escopo:** Todo o diretório `src/`

---

## 1. ESTRUTURA REAL

### Mapa de arquivos

```
src/main/
  index.ts            (201 linhas)  Boot Electron, janela, CSP, registro de handlers
  preload.ts          (131 linhas)  contextBridge — expõe window.api.*
  ipc/
    terminal.ts        (67 linhas)  PTY via node-pty — REAL
    files.ts          (170 linhas)  File I/O com path sanitization — REAL
    claude.ts         (266 linhas)  Claude CLI (check/install/auth/voice/skills)
    github.ts         (300 linhas)  OAuth + git clone/sync/pull/push/branches
    license.ts        (142 linhas)  Validação online + cache local encriptado
  services/
    auto-setup.ts     (210 linhas)  Verifica Node/Git/Claude no boot
    updater.ts        (não auditado — fora do escopo crítico)
    keychain.ts       (não auditado — wrapper keytar)

src/renderer/
  App.tsx              (53 linhas)  Router de telas — correto
  types.d.ts           (98 linhas)  Tipos ElectronAPI
  screens/
    Splash.tsx        (120 linhas)  Animação de boot com SVG — apenas visual
    Setup.tsx         (400 linhas)  Instala dependências, verifica auth Claude
    License.tsx       (219 linhas)  Ativação de chave INFT-XXXX
    IDE.tsx           (385 linhas)  Orquestrador principal — composição de hooks
  hooks/
    useFileManager.ts (103 linhas)  Estado de arquivos + IPC
    useTerminal.ts     (81 linhas)  Terminal + detecção de porta
    useGitHub.ts       (75 linhas)  Clone, auth, repos
    useGitPanel.ts     (15 linhas)  Estado simples do painel git
    usePanels.ts       (35 linhas)  Toggle visibilidade painéis
  components/
    Editor.tsx         (75 linhas)  Monaco wrapper — REAL
    Terminal.tsx      (106 linhas)  xterm.js wrapper — REAL
    FileTree.tsx      (199 linhas)  Árvore recursiva de arquivos — REAL
    GitPanel.tsx      (412 linhas)  UI git completa — REAL (ver ressalvas)
    IntelliChat.tsx   (250 linhas)  Chat UI — REAL mas arquitetura não-óbvia (ver §3)
    Preview.tsx       (296 linhas)  iframe + auto-detect de porta — REAL
    Toolbar.tsx       (não auditado linha a linha)
    ErrorBoundary.tsx  (59 linhas)  Classe React ErrorBoundary — correto
    VoiceButton.tsx   (não auditado linha a linha)
  utils/
    path.ts           (não auditado)
```

---

## 2. O QUE FUNCIONA DE VERDADE HOJE

### Fluxo completo testável end-to-end

| Funcionalidade | Status | Como funciona |
|---|---|---|
| Boot com splash | ✅ Real | Animação SVG 2.5s mínimo |
| Verificação de licença no boot | ✅ Real | IPC → ElectronStore encriptado |
| Instalação automática de dependências | ✅ Real | `execSync` node/git/npm install |
| Terminal interativo | ✅ Real | `node-pty` → `xterm.js` |
| Abrir pasta do projeto | ✅ Real | `dialog.showOpenDialog` |
| Leitura/escrita de arquivos | ✅ Real | `fs.readFile` / `fs.writeFile` |
| Árvore de arquivos | ✅ Real | `readDir` recursivo, maxDepth=3 |
| Salvar arquivo (Cmd+S) | ✅ Real | Escreve via IPC |
| Watch de mudanças no filesystem | ✅ Real | `fs.watch` com debounce 300ms |
| Monaco Editor | ✅ Real | `@monaco-editor/react` |
| Preview com iframe | ✅ Real | Detecta porta no output do terminal |
| GitHub OAuth | ✅ Real | HTTP server local na porta 4242 |
| Clone de repositório | ✅ Real | `git clone` via spawn |
| git sync (add → commit → pull → push) | ✅ Real | 4 processos sequenciais via spawn |
| git pull / push | ✅ Real | spawn direto |
| Branches | ✅ Real | `git branch` / `git checkout` |
| Validação de licença online | ✅ Real | POST `app-infinitcode.netlify.app` |
| Claude Code via chat | ✅ Real* | *Injeta no terminal — ver §3 |
| Skills pré-configuradas | ✅ Real | Cria arquivos `.md` em `~/.claude/skills` |

### O que abre mas não faz nada de útil
- **VoiceButton**: Injeta `/voice\r` no terminal. Funciona SE o Claude Code instalado suportar. Sem feedback de erro se versão antiga.
- **Preview**: Mostra iframe mas pode pegar porta errada (qualquer porta no stdout do terminal).

---

## 3. O QUE ESTÁ QUEBRADO OU PROBLEMÁTICO

### 3.1 IntelliChat — arquitetura não-óbvia, documentação zero
**O chat NÃO chama a API Anthropic diretamente.**
Ele injeta texto no terminal onde o `claude` CLI está rodando via `onTerminalInject`.

```typescript
// IntelliChat.tsx linha 243 — "enviar mensagem" = injetar no terminal
function runQuickAction(action) {
  onTerminalInject(action.inject);  // ← digita no terminal
}
```

Isso significa:
- Se o usuário não tiver iniciado `claude` no terminal, o chat não funciona
- Não há confirmação visual de que Claude está recebendo
- QUICK_ACTIONS usam `--dangerously-skip-permissions` hardcoded — bypassa todas as confirmações de segurança do Claude Code sem avisar o usuário

### 3.2 useFileManager — watcher leak (bug real)
```typescript
// useFileManager.ts linha 27-34
useEffect(() => {
  loadFiles(projectPath);
  window.api.terminal.create(projectPath);
  window.api.files.watch(projectPath);           // ← abre watcher
  const cleanup = window.api.files.onChanged(…); // ← cleanup só remove listener
  return cleanup;                                 // ← NÃO fecha o watcher
}, [projectPath, loadFiles]);
```
**Efeito:** Cada vez que o usuário troca de projeto, um novo watcher é aberto e o anterior nunca fecha. Com 5 trocas de projeto, há 5 watchers ativos no mesmo diretório.

### 3.3 useFileManager — Cmd+S stale closure (bug real)
```typescript
useEffect(() => {
  function onKey(e) { handleSave(); }  // ← captura handleSave do closure
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [openFile, fileContent, isModified]);  // ← handleSave ausente nas deps
```
`handleSave` é redeclarado a cada render mas a dependência não está listada. Em React com Strict Mode, pode salvar versão antiga do conteúdo.

### 3.4 DEV_BYPASS_KEY hardcoded em produção
```typescript
// license.ts linha 70
const DEV_BYPASS_KEY = 'INFT-DEV0-TEST-0000-0000';
if (key === DEV_BYPASS_KEY) return { valid: true, plan: 'pro' };
```
Qualquer pessoa com essa chave tem acesso vitalício ao plano pro sem validação. Deve ser removido antes de build de produção ou protegido por variável de ambiente de build.

### 3.5 Chave de encriptação hardcoded
```typescript
// license.ts — ElectronStore
encryptionKey: 'infinit-code-desktop-2026'
```
Não é criptografia real se a chave está no binário. Protege contra leitura casual do arquivo, não contra extração do binário. Não é crítico para um app desktop, mas não deve ser chamado de "encriptado".

### 3.6 CSP permissiva demais
```
"script-src 'self' 'unsafe-inline' 'unsafe-eval'"
```
`unsafe-eval` é exigido pelo Monaco (conhecido). `unsafe-inline` é o problema — qualquer HTML injetado pode executar scripts. Aceitável para app desktop sem conteúdo de terceiros não-confiáveis, mas deve ser documentado como decisão consciente.

### 3.7 git sync — commit message não configurável
```typescript
// github.ts linha 231
['git', ['commit', '-m', `auto-sync: ${ts}`]],
```
Sempre usa mensagem automática. Usuário não escolhe o que está commitando. Para uso profissional, isso é problemático.

### 3.8 auto-setup — sudo npm sem aviso
```typescript
// claude.ts linha 38
exec('sudo npm install -g @anthropic-ai/claude-code 2>&1', ...)
```
Tenta sudo silenciosamente se npm falha. No macOS moderno, isso abre prompt do sistema sem contexto. Usuário não sabe o que está aprovando.

### 3.9 Sem testes
Zero arquivos de teste. Nenhuma suite. `npm test` não existe no `package.json`.

---

## 4. DEPENDÊNCIAS

### Usadas de verdade
```
electron              41.0.3  — core
react / react-dom     18.3.1  — UI
@monaco-editor/react   4.7.0  — editor
@xterm/xterm           6.0.0  — terminal UI
@xterm/addon-*                — addons do terminal
node-pty               1.1.0  — PTY real
electron-store         8.2.0  — persistência
keytar                 7.9.0  — credenciais seguras (GitHub token)
dotenv                17.3.1  — variáveis de ambiente
electron-updater              — auto-update
```

### Instaladas, uso não confirmado
```
electron-squirrel-startup     — legado, pode ser removido se não usar Squirrel
```

### Ausentes mas necessárias para crescer
```
(sem testing library)         — sem jest, vitest, playwright
(sem state management)        — sem zustand/jotai (hooks puros por ora — ok)
(sem error tracking)          — sem Sentry ou similar
```

---

## 5. AVALIAÇÃO BRUTAL

### O que está PRONTO (pode ser entregue hoje)
- Boot flow completo (Splash → Setup → License → IDE)
- Terminal interativo real com node-pty
- Editor Monaco funcional com syntax highlight
- File tree + leitura/escrita de arquivos com proteção de path
- GitHub OAuth + clone funcional
- git sync real (add → commit → pull → push)
- Preview com auto-detecção de porta
- Sistema de licença com validação online + cache offline
- ErrorBoundary em todos os painéis

### O que é RASCUNHO (funciona mas vai dar problema)
- **IntelliChat**: Funciona mas a arquitetura de "injetar no terminal" não é óbvia, não tem feedback de estado, e QUICK_ACTIONS usam `--dangerously-skip-permissions` sem aviso ao usuário
- **git sync**: Funciona mas commit message automático é limitante para uso real
- **Preview**: Funciona mas detecção de porta pode pegar porta errada em projetos com múltiplos processos
- **Setup timeout**: 8s para verificar auth é apertado; em máquinas lentas ou rede ruim vai falhar

### O que precisa ser CORRIGIDO antes de lançar
1. `useFileManager` — fechar watcher ao trocar projeto (memory leak garantido)
2. `useFileManager` — `handleSave` nas deps do useEffect do Cmd+S
3. `DEV_BYPASS_KEY` — remover de build de produção ou gate por `process.env.NODE_ENV`
4. `IntelliChat` QUICK_ACTIONS — remover `--dangerously-skip-permissions` ou avisar o usuário explicitamente
5. `sudo npm install` — pelo menos logar aviso antes de tentar

### O que pode ser IGNORADO por ora
- Falta de testes (técnica dívida, não bloqueio)
- CSP com unsafe-eval (necessário para Monaco)
- Chave de encriptação hardcoded (proteção casual, suficiente para desktop)
- ElectronStore encryption key (não é segurança real, mas não é pior do que o padrão do mercado)

---

## RESUMO EXECUTIVO

**4.500 linhas de código, ~30 arquivos. Base sólida com 3 bugs concretos e 2 riscos de produto.**

O projeto está mais perto de beta do que de protótipo. A arquitetura está correta, a separação de responsabilidades existe, e as integrações reais (terminal, git, licença, Monaco) funcionam. Não é rascunho.

Os problemas são cirúrgicos: memory leak no watcher, stale closure no Cmd+S, e a chave dev no código. Corrigir os três leva menos de uma hora.

O risco de produto maior é o IntelliChat: o usuário não vai entender que precisa de `claude` rodando no terminal para o chat funcionar. Isso vai gerar confusão e tickets de suporte. Merece tratamento antes do lançamento — pelo menos uma tela de onboarding ou estado vazio explicando o fluxo.
