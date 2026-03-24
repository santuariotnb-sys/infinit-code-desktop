# Pesquisa Técnica — Infinit Code Desktop
> Data: 2026-03-24 | Foco: Electron + node-pty + Claude Code CLI

---

## 1. Electron UtilityProcess vs child_process.fork vs spawn

### O que é

`utilityProcess` (introduzido no Electron 20, estável no 22+) cria um processo filho Node.js via Chromium Services API — diferente de `child_process.fork` que usa a runtime do Node puro.

### Diferenças fundamentais

| Critério | `utilityProcess` | `child_process.fork` | `child_process.spawn` |
|---|---|---|---|
| Comunicação com renderer | Sim — via `MessagePort` nativo | Não diretamente | Não |
| Crash isolation | Sim — processo separado do main | Parcial | Sim |
| Pode usar módulos nativos (`.node`) | Sim, se recompilados para Electron | Problemas conhecidos | Sim |
| IPC com main | `postMessage` / MessageChannel | `process.send` / IPC pipe | stdin/stdout |
| Recomendado pela Electron team | **Sim** | Não (legado) | Para processos externos |

### Recomendação atual (2025-2026)

A documentação oficial diz explicitamente:

> "An Electron app can always prefer the UtilityProcess API over Node.js child_process.fork API."

**Use `utilityProcess` quando:** hospedar serviços pesados (language servers, file watchers, compiladores) que precisam comunicar com o renderer.

**Use `child_process.spawn` quando:** lançar CLIs externos como Claude Code — porque você quer um processo completamente isolado com stdin/stdout/stderr separados.

**Nunca use `child_process.fork` no Electron** — módulos nativos como `node-pty` quebram porque o processo filho herda o contexto V8 do Electron em vez do Node puro (issue #8727 no electron/electron).

### Arquitetura recomendada para Infinit Code

```
main process
  ├── utilityProcess: file watcher, git service (heavy, precisa MessagePort)
  └── child_process.spawn: claude CLI process (externo, usa PTY via node-pty)
        └── node-pty spawna o PTY real (só no main process, nunca no renderer)
```

---

## 2. node-pty — Melhores Práticas

### Estado atual (2025)

- Versão estável: `0.11.x` (microsoft/node-pty)
- Tabby usa fork próprio: `@tabby-gang/node-pty` (patches para bugs específicos)
- VS Code usa node-pty internamente no processo `ptyHost` (separado do main via `utilityProcess`)
- **Requer rebuild** para cada versão do Electron: `electron-rebuild` ou `@electron/rebuild`

### Problemas conhecidos e como evitar

#### Zombie processes (crítico)

Problema: PTY spawna com `detached: true` + `unref()` mas o método de cleanup só fecha o socket — o processo daemon continua vivo.

Solução obrigatória:
```typescript
// No app.on('before-quit') e app.on('window-all-closed')
import { execSync } from 'child_process'

app.on('before-quit', () => {
  for (const pty of activePtys) {
    try {
      pty.kill()  // envia SIGHUP ao processo PTY
    } catch (e) {
      // ignora se já morreu
    }
  }
})
```

Para processos que spawnam filhos próprios (como Claude Code), use `tree-kill`:
```typescript
import treeKill from 'tree-kill'
treeKill(pty.pid, 'SIGTERM')
```

#### Unicode / paste grande (macOS/Linux)

Problema: colar >1KB de texto causa data interleaving ou drop.

Solução: habilitar flow control:
```typescript
const pty = spawn('bash', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  handleFlowControl: true,  // OBRIGATÓRIO para pastes grandes
  flowControlPause: '\x13',  // XOFF
  flowControlResume: '\x11', // XON
})
```

#### Windows (ConPTY)

- Requer Windows 10 1809+ (build 18309) — suporte ao WinPTY foi removido
- `TERM=xterm-256color` não funciona no Windows — usar `xterm` simples
- ConPTY tem latência maior que Unix PTY — não tente otimizar com flush manual

#### Thread safety

`node-pty` **não é thread-safe**. Nunca use em worker threads. Sempre no main process ou em um `utilityProcess` dedicado.

#### Registro do handler de saída

Importante: registrar `process.on('exit')` e `process.on('SIGINT')` **depois** de spawnar o PTY, não antes (issue #190 node-pty):
```typescript
const pty = spawn(shell, [], options)
// DEPOIS do spawn:
process.on('exit', () => pty.kill())
pty.onExit(({ exitCode }) => {
  console.log('[PTY] exited with', exitCode)
  cleanup()
})
```

### Arquitetura VS Code como referência

VS Code isola node-pty em um processo separado chamado `ptyHost`:
- Main process cria `utilityProcess` para o ptyHost
- Renderer comunica via MessagePort (não ipcMain)
- ptyHost gerencia todos os PTYs — crash não derruba o editor

Para Infinit Code, uma versão simplificada suficiente:
```
main process
  └── node-pty (no próprio main process por enquanto)
       └── onData → ipcMain.webContents.send('terminal:data', chunk)
```

Migrar para `utilityProcess` só faz sentido se tiver múltiplos terminais simultâneos ou se o processo principal estiver travando.

---

## 3. Claude Code CLI — Como Integrar Corretamente

### Protocolo de comunicação

Claude Code funciona de dois modos:

**Modo interativo (PTY):** `claude` sem flags — espera um TTY real. O processo checa `isatty(stdin)` e abre a TUI completa.

**Modo headless (stdin/stdout JSON):**
```bash
claude -p "prompt aqui" --output-format stream-json
```
Neste modo NÃO precisa de PTY. Usa JSON Lines (NDJSON) no stdout.

### O que Claude Code espera do ambiente

```typescript
// Variáveis de ambiente OBRIGATÓRIAS para modo interativo via PTY
const env = {
  ...process.env,
  TERM: 'xterm-256color',
  COLORTERM: 'truecolor',
  // NÃO setar estas vars ou o CLI entra em modo headless:
  // CI=true  ← força modo não-interativo
  // NO_COLOR ← desativa cores
}
```

**Problema documentado:** Claude Code spawna subprocessos para detectar aliases/shell config. Esses subprocessos herdam stdin e podem consumir o input, causando EOF prematuro. Solução: usar PTY real (node-pty) em vez de spawn com pipes.

**Modo headless para automação (como IntelliChat):**
```typescript
import { spawn } from 'child_process'

const proc = spawn('claude', ['-p', prompt, '--output-format', 'stream-json'], {
  cwd: projectPath,
  env: { ...process.env },
  // SEM PTY aqui — stdin/stdout puros
})

proc.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n').filter(Boolean)
  for (const line of lines) {
    const msg = JSON.parse(line)
    // msg.type: 'assistant' | 'tool_use' | 'tool_result' | 'result'
    webContents.send('intellichat:stream', msg)
  }
})
```

**Formato stream-json:** cada linha é um objeto JSON completo:
```json
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
{"type": "result", "subtype": "success", "cost_usd": 0.003}
```

### Como Cursor/Windsurf integram

Cursor e Windsurf **não spawnam o Claude Code CLI** — eles chamam a API Anthropic diretamente usando suas próprias chaves. A integração com Claude Code é via extensão VS Code que:
1. Detecta se `claude` está no PATH
2. Abre um terminal integrado com PTY
3. Comunica via socket local (127.0.0.1 porta aleatória) + lock file em `~/.claude/ide/`
4. Token de auth gerado a cada ativação da extensão (escrito com permissão 0600)

Para Infinit Code, a abordagem mais correta é **PTY para modo interativo** + **spawn headless para automação no IntelliChat**.

---

## 4. Electron IPC Performance — Terminal Streaming

### Comparação de abordagens

| Abordagem | Latência | Overhead | Uso ideal |
|---|---|---|---|
| `ipcMain` + `webContents.send` | ~1-3ms | Serialização JSON | Eventos esporádicos |
| `MessagePort` direto | ~0.5ms | Mínimo | Streams contínuos |
| `contextBridge` (apenas expose) | N/A | Zero (é só exposição) | API segura no preload |

### Para streaming de terminal (dados frequentes)

**Recomendação:** usar `MessagePort` para terminal output quando a frequência for alta.

Setup uma vez, reutilizar:
```typescript
// main process — setup ao criar a janela
const { port1, port2 } = new MessageChannelMain()

// Enviar port2 para o renderer via ipcMain (uma única vez)
mainWindow.webContents.postMessage('terminal:port', null, [port2])

// Depois usar port1 para streaming — bypass do preload script
ptyProcess.onData((data) => {
  port1.postMessage({ type: 'data', payload: data })
})
```

```typescript
// renderer — receber e usar
ipcRenderer.on('terminal:port', (event) => {
  const port = event.ports[0]
  port.onmessage = (e) => terminal.write(e.data.payload)
})
```

**Para Infinit Code especificamente:** o overhead do `ipcMain` padrão provavelmente é aceitável para um único terminal. Só vale migrar para MessagePort se medir latência perceptível ou se tiver >3 terminais simultâneos.

### O que evitar

- `ipcRenderer.sendSync` — bloqueia o renderer (nunca use para terminal)
- Serializar buffers como string base64 via IPC — use `Buffer` diretamente ou `ArrayBuffer` via MessagePort
- `webContents.send` em loop de alta frequência sem throttle — pode saturar a fila IPC

---

## 5. Apps Similares — Referências Arquiteturais

### Tabby (github.com/Eugeny/tabby)
- Stack: Electron + Angular + TypeScript + `@tabby-gang/node-pty` (fork próprio)
- Arquitetura: modular via plugins Angular, cada feature é um módulo separado
- PTY: node-pty no main process, comunicação via IPC customizado
- Diferencial: suporte SSH nativo, serial port, SFTP

### Warp Terminal
- **Não usa Electron** — Rust + WebGPU para rendering
- Irrelevante como referência de arquitetura para Infinit Code

### VS Code Terminal (referência mais relevante)
- `utilityProcess` dedicado (`ptyHostMain`) para todos os PTYs
- MessagePort entre ptyHost e renderer para streaming
- Shell integration via sequências OSC (detecção de prompt, CWD, exit code)
- Código fonte: `src/vs/platform/terminal/` no repositório microsoft/vscode

### Wrappers de CLI de IA (mais próximos do Infinit Code)

**Nenhum projeto maduro encontrado** que use exatamente a mesma abordagem (Electron wrapper para Claude Code CLI com PTY). Os projetos existentes são:
- Aider: CLI puro, sem GUI oficial
- Continue.dev: extensão VS Code (não Electron standalone)
- Auto-Claude (github.com/AndyMik90/Auto-Claude): wrapper simples, tem issue documentada de zombie processes

**Conclusão:** Infinit Code está em território relativamente inexplorado. A referência mais sólida é a implementação do terminal do VS Code.

---

## Resumo de Ações para Infinit Code

| Prioridade | Ação | Arquivo alvo |
|---|---|---|
| Alta | Adicionar `handleFlowControl: true` no spawn do PTY | `src/main/ipc/terminal.ts` |
| Alta | Implementar cleanup de PTY no `app.on('before-quit')` | `src/main/ipc/terminal.ts` |
| Alta | Usar `tree-kill` para cleanup do processo Claude | `src/main/ipc/terminal.ts` |
| Média | IntelliChat: migrar para `spawn` headless com `--output-format stream-json` | `src/main/ipc/files.ts` ou novo handler |
| Média | Registrar `pty.onExit` handler após o spawn | `src/main/ipc/terminal.ts` |
| Baixa | Avaliar MessagePort para streaming se performance for issue | `src/main/ipc/terminal.ts` + preload |
| Baixa | Avaliar `utilityProcess` se tiver múltiplos terminais | Refactor maior |

---

## Fontes

- [Electron UtilityProcess docs](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [MessagePorts in Electron](https://www.electronjs.org/docs/latest/tutorial/message-ports)
- [node-pty GitHub](https://github.com/microsoft/node-pty)
- [node-pty DeepWiki](https://deepwiki.com/microsoft/node-pty)
- [node-pty issue #382 — how to kill PTY in Electron](https://github.com/microsoft/node-pty/issues/382)
- [node-pty PR #240 — SIGINT handling option](https://github.com/microsoft/node-pty/pull/240/files)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code VS Code integration](https://code.claude.com/docs/en/vs-code)
- [Claude Code bug — stdin consumed by shell detection](https://github.com/anthropics/claude-code/issues/12507)
- [Tabby terminal GitHub](https://github.com/Eugeny/tabby)
- [Electron Forge + node-pty (Medium)](https://thomasdeegan.medium.com/electron-forge-node-pty-9dd18d948956)
- [Claude Code headless mode](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/tutorial/)
