# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |

---

# Padrões de Código — Infinit Desktop

Estas regras se aplicam a TODO código escrito neste projeto. São obrigatórias.

## 1. Responsabilidade única (SRP)

- Componentes React com >150 linhas DEVEM ser quebrados
- Cada hook customizado gerencia UM domínio: `useFileManager`, `useTerminal`, `useGitPanel`, `useChatPanel`
- Nunca misturar lógica de negócio com renderização no mesmo componente
- `IDE.tsx` é o orquestrador — não contém lógica, apenas composição de hooks e componentes

## 2. IPC Handlers — sempre com tratamento de erro

Todo handler IPC deve seguir este padrão:

```typescript
// OBRIGATÓRIO em todo ipcMain.handle
ipcMain.handle('canal:acao', async (_, args) => {
  try {
    // lógica aqui
    return { ok: true, data: resultado }
  } catch (error) {
    console.error('[canal:acao]', error)
    return { ok: false, error: (error as Error).message }
  }
})
```

No renderer, sempre verificar `result.ok` antes de usar `result.data`.

## 3. Async — padrões obrigatórios

```typescript
// Operações independentes paralelas: Promise.allSettled (nunca Promise.all nu)
const results = await Promise.allSettled([op1(), op2(), op3()])
const failed = results.filter(r => r.status === 'rejected')

// NUNCA await em loop sequencial quando pode ser paralelo
// ❌ for (const f of files) { await processFile(f) }
// ✅ await Promise.allSettled(files.map(processFile))
```

## 4. Nomeação

- Booleanos: prefixo `is`, `has`, `can`, `should` → `isLoading`, `hasChanges`, `canSave`
- Handlers de evento: prefixo `handle` → `handleFileSave`, `handleBranchSwitch`
- Funções IPC no renderer: prefixo `invoke` → `invokeCloneRepo`, `invokeReadFile`
- Arrays: sempre plural → `openFiles`, `branches`, `messages`

## 5. Error Boundaries

Todo painel principal do IDE deve ser envolvido em ErrorBoundary:
`FileTree`, `Terminal`, `Editor`, `IntelliChat`, `GitPanel`, `Preview`

Se um painel crashar, os outros continuam funcionando.

## 6. Separação de camadas

```
renderer/hooks/     ← lógica de estado e IPC (useFileManager, etc.)
renderer/components/ ← apenas UI, recebe props, sem chamadas IPC diretas
renderer/screens/   ← composição de componentes e hooks
main/ipc/           ← handlers IPC, sem lógica de UI
main/services/      ← lógica de negócio do processo main
```

Componentes em `components/` NUNCA chamam `window.api` diretamente.
Apenas hooks em `hooks/` fazem chamadas IPC.

## 7. KISS — simplicidade primeiro

- Não criar abstração para uso único
- Não adicionar feature sem ser solicitado
- Não adicionar prop opcional "para o futuro"
- Se funciona simples, não complexificar
