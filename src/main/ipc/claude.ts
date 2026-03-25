import { ipcMain, BrowserWindow, shell } from 'electron';
import { execSync, exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Guarda session_id por janela para memória contínua
const sessions = new Map<number, string>();

// Caminhos comuns onde o claude pode estar instalado
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
  // fallback: tentar via shell com PATH expandido
  try {
    const extraPath = [
      path.join(os.homedir(), '.local', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ].join(':');
    return execSync('which claude', {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, PATH: `${extraPath}:${process.env.PATH ?? ''}` },
    }).trim();
  } catch {
    return 'claude'; // último recurso
  }
}

const CLAUDE_BIN = findClaudeBinary();

// PATH enriquecido para todos os spawns
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

  // ── API direta — fallback quando CLI não está instalado ──
  async function askViaApi(
    prompt: string,
    cwd: string,
    sender: Electron.WebContents,
  ): Promise<{ ok: boolean; cost_usd: number; sessionId: null }> {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não encontrada. Adicione no seu ambiente ou no arquivo .env do projeto.');

    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      stream: true,
      system: `Você é um assistente de desenvolvimento de software especializado. Diretório de trabalho: ${cwd}. Execute tarefas diretamente sem pedir confirmação adicional, a menos que seja explicitamente solicitado pelo usuário.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API erro ${res.status}: ${errText.slice(0, 200)}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            sender.send('claude:chunk', { text: json.delta.text });
          }
          if (json.type === 'message_delta' && json.usage?.output_tokens) {
            outputTokens = json.usage.output_tokens;
          }
        } catch { /* linha inválida */ }
      }
    }

    // ~$3/MTok Sonnet estimativa
    return { ok: true, cost_usd: outputTokens * 0.000003, sessionId: null };
  }

  // ── Headless ask — sessão contínua ───────────────────────
  ipcMain.handle('claude:ask', async (event, payload: {
    prompt: string;
    cwd: string;
    sessionId?: string;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const winId = win?.id ?? 0;

    const existingSession = payload.sessionId ?? sessions.get(winId);

    const args = [
      '-p', payload.prompt,
      '--output-format', 'stream-json',
      '--bare',
      '--dangerously-skip-permissions',
      '--max-turns', '10',
    ];

    if (existingSession) {
      args.push('--resume', existingSession);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(CLAUDE_BIN, args, {
        cwd: payload.cwd,
        env: RICH_ENV,
      });

      let newSessionId: string | null = null;
      let totalCost = 0;
      const chunks: object[] = [];

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('timeout: Claude demorou mais de 120s'));
      }, 120_000);

      proc.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            chunks.push(json);
            if (json.session_id) newSessionId = json.session_id;
            if (json.cost_usd) totalCost = json.cost_usd;
            if (json.type === 'stream_event' && json.event?.delta?.type === 'text_delta') {
              event.sender.send('claude:chunk', { text: json.event.delta.text });
            }
            if (json.type === 'tool_use' && json.name) {
              event.sender.send('claude:tool', { name: json.name, input: json.input });
            }
          } catch { /* linha não JSON */ }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.includes('Error') || text.includes('error')) {
          event.sender.send('claude:error', { message: text });
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (newSessionId) sessions.set(winId, newSessionId);
        resolve({ ok: code === 0, sessionId: newSessionId, cost_usd: totalCost, chunks });
      });

      proc.on('error', async (err) => {
        clearTimeout(timeout);
        // CLI não encontrado → tenta API direta
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          try {
            const result = await askViaApi(payload.prompt, payload.cwd, event.sender);
            resolve(result);
          } catch (apiErr) {
            reject(apiErr);
          }
        } else {
          reject(err);
        }
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
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY);
    return new Promise((resolve) => {
      const proc = spawn(CLAUDE_BIN, ['--version'], { timeout: 5000, env: RICH_ENV });
      let version = '';
      proc.stdout.on('data', (d: Buffer) => (version += d.toString()));
      proc.on('close', (code) => resolve({ installed: code === 0 || hasApiKey, version: version.trim(), hasApiKey }));
      proc.on('error', () => resolve({ installed: hasApiKey, version: null, hasApiKey }));
    });
  });
}
