# Skill: Novo IPC handler (Electron)

## Quando usar
Pedidos como: "comunicar com o main", "novo handler", "IPC", "chamar do backend", "preload"

## Arquitetura IPC do Infinit Code

```
Renderer (React)
  → window.api.modulo.acao()        // preload.ts
    → ipcRenderer.invoke('canal')   // preload.ts
      → ipcMain.handle('canal')     // main/ipc/modulo.ts
        → retorna resultado
```

## Os 3 arquivos que sempre mudam

### 1. Handler no main — `src/main/ipc/modulo.ts`
```typescript
import { ipcMain, BrowserWindow } from 'electron';

export function registerModuloHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('modulo:acao', async (_event, arg1: string, arg2: number) => {
    try {
      // lógica aqui
      const resultado = await algumaOperacao(arg1, arg2);
      return { ok: true, data: resultado };
    } catch (error) {
      console.error('[modulo:acao]', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  // Enviar evento pro renderer (push, não request):
  // mainWindow.webContents.send('modulo:evento', dados);
}
```

### 2. Bridge no preload — `src/main/preload.ts`
```typescript
// Dentro de contextBridge.exposeInMainWorld('api', { ... })
modulo: {
  acao: (arg1: string, arg2: number) =>
    ipcRenderer.invoke('modulo:acao', arg1, arg2),
  // Listener para eventos push:
  onEvento: (cb: (data: TipoData) => void) => {
    const handler = (_: Electron.IpcRendererEvent, d: TipoData) => cb(d);
    ipcRenderer.on('modulo:evento', handler);
    return () => ipcRenderer.removeListener('modulo:evento', handler);
  },
},
```

### 3. Tipos no renderer — `src/renderer/types.d.ts`
```typescript
// Dentro de Window['api']
modulo: {
  acao: (arg1: string, arg2: number) => Promise<{ ok: boolean; data?: T; error?: string }>;
  onEvento: (cb: (data: TipoData) => void) => () => void;
};
```

## Registrar no index.ts
```typescript
import { registerModuloHandlers } from './ipc/modulo';
// Dentro de if (!handlersRegistered):
registerModuloHandlers(mainWindow);
```

## Regras obrigatórias

- Todo handler retorna `{ ok: true, data }` ou `{ ok: false, error }`
- Todo handler tem try/catch
- Nomes de canal: `modulo:acao` (kebab com namespace)
- Preload NUNCA expõe ipcRenderer diretamente
- contextIsolation: true sempre
- Listeners devem retornar função de cleanup (removeListener)
- Cleanup no close da window para evitar memory leak

## Checklist

- [ ] Handler em `main/ipc/` com try/catch
- [ ] Bridge no `preload.ts` com types corretos
- [ ] Tipos em `types.d.ts`
- [ ] Registro no `index.ts`
- [ ] Se tem listener: retorna cleanup function
- [ ] Se tem processo longo: cleanup no window close
