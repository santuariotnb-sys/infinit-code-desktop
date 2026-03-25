import { ipcMain, BrowserWindow, shell, safeStorage } from 'electron';
import { execSync, exec, spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Guarda session_id por janela para memória contínua (CLI path)
const sessions = new Map<number, string>();

// Arquivo para API key criptografada
const API_KEY_PATH = path.join(os.homedir(), '.infinitcode', 'ak');

// ── API Key (safeStorage) ────────────────────────────────────
function getStoredApiKey(): string {
  // 1. Variável de ambiente tem prioridade
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // 2. Chave salva via safeStorage
  try {
    if (fs.existsSync(API_KEY_PATH)) {
      const buf = fs.readFileSync(API_KEY_PATH);
      return safeStorage.decryptString(buf);
    }
  } catch { /* ignora */ }
  return '';
}

// ── Caminhos do binário Claude Code CLI ─────────────────────
const CLAUDE_SEARCH_PATHS = [
  path.join(os.homedir(), '.local', 'bin', 'claude'),
  '/usr/local/bin/claude',
  '/opt/homebrew/bin/claude',
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
  '/usr/bin/claude',
];

function findClaudeBinary(): string {
  for (const p of CLAUDE_SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  // Login shell: usa o PATH completo do usuário (nvm, volta, homebrew, etc.)
  try {
    const shell = process.env.SHELL || '/bin/bash';
    return execSync(`${shell} -lc "which claude"`, {
      encoding: 'utf-8', timeout: 5000,
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

// ── SDK Anthropic — streaming real token a token ─────────────
async function askViaSDK(
  prompt: string,
  cwd: string,
  sender: Electron.WebContents,
): Promise<{ ok: boolean; cost_usd: number; sessionId: null }> {
  const apiKey = getStoredApiKey();
  if (!apiKey) throw new Error('Chave API não configurada. Adicione em Configurações → Claude Code → Chave API.');

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 8096,
    system: `Você é um assistente especializado em desenvolvimento de software. Diretório de trabalho: ${cwd}. Execute tarefas diretamente sem pedir confirmação, a menos que explicitamente solicitado pelo usuário.`,
    messages: [{ role: 'user', content: prompt }],
  });

  stream.on('text', (text) => {
    if (!sender.isDestroyed()) sender.send('claude:chunk', { text });
  });

  stream.on('error', (err) => {
    if (!sender.isDestroyed()) sender.send('claude:error', { message: err.message });
  });

  const final = await stream.finalMessage();
  const cost = (final.usage.input_tokens * 3 + final.usage.output_tokens * 15) / 1_000_000;
  return { ok: true, cost_usd: cost, sessionId: null };
}

export function registerClaudeHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('claude:check-installed', () => {
    try {
      const version = execSync(`"${CLAUDE_BIN}" --version`, { encoding: 'utf-8', timeout: 5000, env: RICH_ENV }).trim();
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

    // Watch for auth file changes
    const authDir = path.join(os.homedir(), '.claude');
    const configPath = path.join(os.homedir(), '.claude.json');
    let resolved = false;
    const timeout = setTimeout(() => {
      resolved = true;
    }, 300000); // 5 min timeout

    const checkAuth = () => {
      if (resolved) return;
      try {
        const authPath = path.join(authDir, 'auth.json');
        if (fs.existsSync(authPath) || fs.existsSync(configPath)) {
          const authData = fs.existsSync(authPath)
            ? JSON.parse(fs.readFileSync(authPath, 'utf-8'))
            : JSON.parse(fs.readFileSync(configPath, 'utf-8'));

          if (authData.oauthAccount || authData.claudeAiOauth || authData.email) {
            resolved = true;
            clearTimeout(timeout);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('claude:authenticated');
            }
            return;
          }
        }
      } catch { /* ignore */ }
      if (!resolved) {
        setTimeout(checkAuth, 3000);
      }
    };

    setTimeout(checkAuth, 5000);
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
      const versionRaw = execSync(`"${CLAUDE_BIN}" --version`, { encoding: 'utf-8', timeout: 5000, env: RICH_ENV }).trim();
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

  // ── API Key — salvar/ler via safeStorage ─────────────────
  ipcMain.handle('claude:save-api-key', (_, key: string) => {
    try {
      const dir = path.dirname(API_KEY_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const encrypted = safeStorage.encryptString(key.trim());
      fs.writeFileSync(API_KEY_PATH, encrypted);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('claude:get-api-key', () => {
    const key = getStoredApiKey();
    return { configured: !!key, masked: key ? `sk-ant-...${key.slice(-4)}` : '' };
  });

  // ── Headless ask — SDK (streaming real) ou CLI fallback ──
  ipcMain.handle('claude:ask', async (event, payload: {
    prompt: string;
    cwd: string;
    sessionId?: string;
  }) => {
    // Prioridade 1: SDK com API key → streaming token a token
    const apiKey = getStoredApiKey();
    if (apiKey) {
      return askViaSDK(payload.prompt, payload.cwd, event.sender);
    }

    // Prioridade 2: Claude Code CLI (requer instalação e auth)
    const win = BrowserWindow.fromWebContents(event.sender);
    const winId = win?.id ?? 0;
    const existingSession = payload.sessionId ?? sessions.get(winId);

    const args = [
      '-p', payload.prompt,
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--max-turns', '10',
    ];
    if (existingSession) args.push('--resume', existingSession);

    return new Promise((resolve, reject) => {
      const proc = spawn(CLAUDE_BIN, args, { cwd: payload.cwd, env: RICH_ENV });

      let newSessionId: string | null = null;
      let totalCost = 0;
      const chunks: object[] = [];

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Timeout: Claude demorou mais de 120s'));
      }, 120_000);

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
                  event.sender.send('claude:chunk', { text: block.text });
                }
              }
            }
            if (json.type === 'tool_use' && json.name) {
              event.sender.send('claude:tool', { name: json.name, input: json.input });
            }
          } catch { /* linha não JSON */ }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.toLowerCase().includes('error')) {
          event.sender.send('claude:error', { message: text.trim() });
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (newSessionId) sessions.set(winId, newSessionId);
        resolve({ ok: code === 0, sessionId: newSessionId, cost_usd: totalCost, chunks });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(
          (err as NodeJS.ErrnoException).code === 'ENOENT'
            ? 'Claude Code CLI não encontrado. Configure sua Chave API em Configurações.'
            : err.message
        ));
      });
    });
  });

  // ── Limpa sessão ─────────────────────────────────────────
  ipcMain.handle('claude:clear-session', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) sessions.delete(win.id);
    return { ok: true };
  });

  // ── Status do Claude Code ────────────────────────────────
  ipcMain.handle('claude:status', async () => {
    const apiKey = getStoredApiKey();
    const hasSdkKey = !!apiKey;
    return new Promise((resolve) => {
      const proc = spawn(CLAUDE_BIN, ['--version'], { timeout: 5000, env: RICH_ENV });
      let version = '';
      proc.stdout.on('data', (d: Buffer) => (version += d.toString()));
      proc.on('close', (code) => resolve({ installed: code === 0 || hasSdkKey, version: version.trim(), hasSdkKey, mode: hasSdkKey ? 'sdk' : 'cli' }));
      proc.on('error', () => resolve({ installed: hasSdkKey, version: null, hasSdkKey, mode: hasSdkKey ? 'sdk' : 'cli' }));
    });
  });
}
