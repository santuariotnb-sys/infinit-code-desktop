import { ipcMain, BrowserWindow, shell } from 'electron';
import { execSync, exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TIMEOUTS, CLAUDE_SEARCH_PATHS } from '../constants';
import { getSecret, setSecret } from '../services/keychain';

// Guarda session_id por janela para memória contínua
const sessions = new Map<number, string>();

// Guarda processo ativo por janela (para cancelamento)
const activeProcesses = new Map<number, ReturnType<typeof spawn>>();

function findClaudeBinary(): string {
  for (const p of CLAUDE_SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  // Login shell: usa o PATH completo do usuário (nvm, volta, homebrew, etc.)
  try {
    const shell = process.env.SHELL || '/bin/bash';
    return execSync(`${shell} -lc "which claude"`, {
      encoding: 'utf-8', timeout: 10_000,
    }).trim();
  } catch {
    return 'claude';
  }
}

const CLAUDE_BIN = findClaudeBinary();

// PATH enriquecido para spawns CLI
const RICH_ENV = {
  ...process.env,
  PATH: [
    path.join(os.homedir(), '.local', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    process.env.PATH ?? '',
  ].join(':'),
};

export function registerClaudeHandlers(mainWindow: BrowserWindow): void {
  // Limpeza quando janela fechar — evita sessions e processos presos na memória
  mainWindow.on('closed', () => {
    const winId = mainWindow.id;
    const proc = activeProcesses.get(winId);
    if (proc) { try { proc.kill('SIGTERM'); } catch { /* já morto */ } }
    activeProcesses.delete(winId);
    sessions.delete(winId);
  });

  ipcMain.handle('claude:check-installed', () => {
    try {
      const version = execSync(`"${CLAUDE_BIN}" --version`, { encoding: 'utf-8', timeout: TIMEOUTS.CLI_SHORT_MS, env: RICH_ENV }).trim();
      return { installed: true, version };
    } catch {
      return { installed: false };
    }
  });

  ipcMain.handle('claude:install', async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      mainWindow.webContents.send('claude:install-progress', { pct: 10, msg: 'Instalando Claude Code...' });

      const cmd = process.platform === 'win32'
        ? 'npm install -g @anthropic-ai/claude-code'
        : 'npm install -g @anthropic-ai/claude-code 2>&1';

      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          // Try with sudo on Mac/Linux
          if (process.platform !== 'win32' && (stderr?.includes('EACCES') || error.message.includes('EACCES'))) {
            mainWindow.webContents.send('claude:install-progress', {
              pct: 30,
              msg: 'Tentando com permissões elevadas...',
            });
            exec('sudo npm install -g @anthropic-ai/claude-code 2>&1', { timeout: 120000 }, (err2) => {
              if (err2) {
                resolve({ success: false, error: err2.message });
              } else {
                mainWindow.webContents.send('claude:install-progress', { pct: 100, msg: 'Instalado!' });
                resolve({ success: true });
              }
            });
          } else {
            resolve({ success: false, error: error.message });
          }
        } else {
          mainWindow.webContents.send('claude:install-progress', { pct: 100, msg: 'Instalado!' });
          resolve({ success: true });
        }
      });
    });
  });

  ipcMain.handle('claude:check-auth', () => {
    try {
      const authPath = path.join(os.homedir(), '.claude', 'auth.json');
      if (fs.existsSync(authPath)) {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        return { authenticated: true, email: auth.email || auth.accountEmail };
      }

      const configPath = path.join(os.homedir(), '.claude.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.oauthAccount || config.claudeAiOauth) {
          return { authenticated: true, email: config.oauthAccount?.emailAddress };
        }
      }

      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  });

  ipcMain.handle('claude:open-auth', () => {
    shell.openExternal('https://claude.ai/login');

    const authDir = path.join(os.homedir(), '.claude');
    const configPath = path.join(os.homedir(), '.claude.json');
    let resolved = false;
    let nextCheckTimer: ReturnType<typeof setTimeout> | null = null;

    const stopPolling = () => {
      resolved = true;
      if (nextCheckTimer) { clearTimeout(nextCheckTimer); nextCheckTimer = null; }
      clearTimeout(globalTimeout);
      mainWindow.removeListener('closed', stopPolling);
    };

    // Para polling se janela fechar — evita timer leak
    mainWindow.once('closed', stopPolling);

    const globalTimeout = setTimeout(stopPolling, TIMEOUTS.CLAUDE_AUTH_POLL_MAX_MS);

    const checkAuth = () => {
      if (resolved) return;
      try {
        const authPath = path.join(authDir, 'auth.json');
        if (fs.existsSync(authPath) || fs.existsSync(configPath)) {
          const authData = fs.existsSync(authPath)
            ? JSON.parse(fs.readFileSync(authPath, 'utf-8'))
            : JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          if (authData.oauthAccount || authData.claudeAiOauth || authData.email) {
            clearTimeout(globalTimeout);
            stopPolling();
            if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('claude:authenticated');
            }
            return;
          }
        }
      } catch { /* ignore */ }
      if (!resolved) {
        nextCheckTimer = setTimeout(checkAuth, TIMEOUTS.CLAUDE_AUTH_POLL_INTERVAL_MS);
      }
    };

    nextCheckTimer = setTimeout(checkAuth, TIMEOUTS.CLAUDE_AUTH_POLL_DELAY_MS);
  });

  ipcMain.handle('claude:install-skills', () => {
    const skillsDir = path.join(os.homedir(), '.claude', 'skills');
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    const skills: Record<string, string> = {
      'frontend-design.md': `---
name: frontend-design
description: Cria interfaces web modernas e responsivas com React, Tailwind CSS e boas práticas de UI/UX.
---

# Frontend Design Skill

Você é um especialista em frontend design. Ao criar interfaces:

- Use Tailwind CSS para estilização
- Priorize responsividade mobile-first
- Use semantic HTML
- Implemente acessibilidade (ARIA labels, contraste, keyboard nav)
- Prefira componentes funcionais React com hooks
- Use animações sutis com CSS transitions
- Siga o design system do projeto quando disponível
`,
      'ui-ux-pro-max.md': `---
name: ui-ux-pro-max
description: Design intelligence para UI/UX profissional com paletas, tipografia e estilos curados.
---

# UI/UX Pro Max Skill

Ao criar interfaces profissionais:

- Defina paleta de cores com primary, secondary, accent, neutral, error, success
- Use escala tipográfica consistente (xs, sm, base, lg, xl, 2xl, 3xl)
- Aplique espaçamento com sistema de 4px/8px
- Crie hierarquia visual clara
- Use sombras para profundidade
- Implemente micro-interações
- Considere dark mode por padrão
`,
      'supabase-agent.md': `---
name: supabase-agent
description: Especialista Supabase para criar tabelas, RLS policies, Edge Functions e queries otimizadas.
---

# Supabase Agent Skill

Ao trabalhar com Supabase:

- Crie tabelas com tipos corretos e constraints
- Sempre implemente RLS policies
- Use Edge Functions para lógica server-side
- Otimize queries com índices apropriados
- Configure auth com providers adequados
- Use realtime apenas quando necessário
- Implemente storage policies para uploads
`,
      'landing-page.md': `---
name: landing-page
description: Cria landing pages de alta conversão com copy persuasivo e design moderno.
---

# Landing Page Skill

Ao criar landing pages:

- Hero section com headline impactante e CTA claro
- Social proof (depoimentos, logos, números)
- Features com ícones e descrições curtas
- Seção de pricing clara
- FAQ para objeções
- Footer com links úteis
- Performance: lazy loading, imagens otimizadas
- SEO: meta tags, Open Graph, structured data
`,
      'code-quality.md': `---
name: code-quality
description: Garante qualidade de código com boas práticas, clean code e padrões consistentes.
---

# Code Quality Skill

Ao revisar e escrever código:

- Nomes descritivos para variáveis e funções
- Funções pequenas com responsabilidade única
- Tratamento de erros adequado
- Tipagem forte (TypeScript strict)
- Testes para lógica crítica
- Sem code smells: código morto, duplicação, complexidade
- Logs estruturados para debugging
- Documentação apenas onde não óbvio
`,
    };

    const installed: string[] = [];
    for (const [filename, content] of Object.entries(skills)) {
      const filepath = path.join(skillsDir, filename);
      fs.writeFileSync(filepath, content, 'utf-8');
      installed.push(filename.replace('.md', ''));
    }

    return { installed };
  });

  // ── Voice status ─────────────────────────────────────────
  ipcMain.handle('claude:voice-status', () => {
    try {
      const versionRaw = execSync(`"${CLAUDE_BIN}" --version`, { encoding: 'utf-8', timeout: TIMEOUTS.CLI_SHORT_MS, env: RICH_ENV }).trim();
      const match = versionRaw.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!match) return { supported: false, version: versionRaw };
      const [, major, minor, patch] = match.map(Number);
      // Voice available since 1.0.69
      const supported = major > 1 || (major === 1 && minor > 0) || (major === 1 && minor === 0 && patch >= 69);
      return { supported, version: versionRaw };
    } catch {
      return { supported: false, version: '' };
    }
  });

  // ── Voice start — inject /voice into terminal ─────────────
  ipcMain.handle('claude:voice-start', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:inject', '/voice\r');
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  // ── Write voice settings ──────────────────────────────────
  ipcMain.handle('claude:write-voice-settings', () => {
    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      let settings: Record<string, unknown> = {};
      if (fs.existsSync(settingsPath)) {
        try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch { /* ignore */ }
      }
      settings.voice = { language: 'pt-BR', pushToTalk: 'space' };
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  // ── Headless ask — Claude Code CLI (mesma auth do terminal) ──
  ipcMain.handle('claude:ask', async (event, payload: {
    prompt: string;
    cwd: string;
    sessionId?: string;
    model?: string;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const winId = win?.id ?? 0;

    // Cancela request anterior se ainda estiver ativo — evita race condition de sessão
    const existingProc = activeProcesses.get(winId);
    if (existingProc) {
      try { existingProc.kill('SIGTERM'); } catch { /* já morto */ }
      activeProcesses.delete(winId);
    }

    const existingSession = payload.sessionId ?? sessions.get(winId);

    const args = [
      '-p', payload.prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--model', payload.model ?? 'claude-sonnet-4-6',
      '--max-turns', '15',
    ];
    if (existingSession) args.push('--resume', existingSession);

    return new Promise((resolve, reject) => {
      const proc = spawn(CLAUDE_BIN, args, { cwd: payload.cwd, env: RICH_ENV });
      activeProcesses.set(winId, proc);

      let newSessionId: string | null = null;
      let totalCost = 0;
      const chunks: object[] = [];

      const sendToWindow = (channel: string, data: unknown) => {
        if (win && !win.isDestroyed()) win.webContents.send(channel, data);
      };

      const warningTimer = setTimeout(() => {
        sendToWindow('claude:error', { message: 'Claude está demorando mais de 1 minuto...' });
      }, TIMEOUTS.CLAUDE_WARNING_MS);

      const timeout = setTimeout(() => {
        clearTimeout(warningTimer);
        proc.kill('SIGTERM');
        sendToWindow('claude:error', { message: 'Timeout: Claude demorou mais de 5 minutos. Tente novamente.' });
        reject(new Error('Timeout: Claude demorou mais de 5 minutos'));
      }, TIMEOUTS.CLAUDE_MAX_MS);

      let stdoutBuffer = '';
      proc.stdout.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            chunks.push(json);
            if (json.type === 'result') {
              if (json.session_id) newSessionId = json.session_id;
              if (json.total_cost_usd) totalCost = json.total_cost_usd;
            }
            if (json.session_id && !newSessionId) newSessionId = json.session_id;
            if (json.type === 'assistant' && Array.isArray(json.message?.content)) {
              for (const block of json.message.content) {
                if (block.type === 'text' && block.text) {
                  sendToWindow('claude:chunk', { text: block.text });
                }
                if (block.type === 'tool_use' && block.name) {
                  sendToWindow('claude:tool', { name: block.name, input: block.input });
                }
              }
            }
          } catch { /* linha não JSON */ }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.toLowerCase().includes('error')) {
          sendToWindow('claude:error', { message: text.trim() });
        }
      });

      proc.on('close', (code) => {
        clearTimeout(warningTimer);
        clearTimeout(timeout);
        activeProcesses.delete(winId);
        if (newSessionId) sessions.set(winId, newSessionId);
        resolve({ ok: code === 0, sessionId: newSessionId, cost_usd: totalCost, chunks });
      });

      proc.on('error', (err) => {
        clearTimeout(warningTimer);
        clearTimeout(timeout);
        activeProcesses.delete(winId);
        reject(new Error(
          (err as NodeJS.ErrnoException).code === 'ENOENT'
            ? `Claude Code CLI não encontrado em "${CLAUDE_BIN}".\nPATH atual: ${RICH_ENV.PATH}\nExecute: npm install -g @anthropic-ai/claude-code`
            : err.message
        ));
      });
    });
  });

  // ── Cancelar processo ativo ───────────────────────────────
  ipcMain.handle('claude:cancel', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const winId = win?.id ?? 0;
    const proc = activeProcesses.get(winId);
    if (proc) {
      proc.kill('SIGTERM');
      activeProcesses.delete(winId);
      return { ok: true };
    }
    return { ok: false };
  });

  // ── Limpa sessão ─────────────────────────────────────────
  ipcMain.handle('claude:clear-session', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) sessions.delete(win.id);
    return { ok: true };
  });

  // ── Status do Claude Code ────────────────────────────────
  ipcMain.handle('claude:status', async () => {
    return new Promise((resolve) => {
      const proc = spawn(CLAUDE_BIN, ['--version'], { timeout: 5000, env: RICH_ENV });
      let version = '';
      proc.stdout.on('data', (d: Buffer) => (version += d.toString()));
      proc.on('close', (code) => resolve({ installed: code === 0, version: version.trim() }));
      proc.on('error', () => resolve({ installed: false, version: null }));
    });
  });

  // ── Anthropic API Key (salvo no keychain) ────────────────
  ipcMain.handle('claude:save-api-key', async (_event, key: string) => {
    try {
      await setSecret('anthropic', key);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('claude:get-api-key', async () => {
    try {
      const key = await getSecret('anthropic');
      if (!key) return { configured: false, masked: '' };
      const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****';
      return { configured: true, masked };
    } catch {
      return { configured: false, masked: '' };
    }
  });
}
