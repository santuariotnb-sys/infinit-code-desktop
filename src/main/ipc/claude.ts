import { ipcMain, BrowserWindow, shell } from 'electron';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function registerClaudeHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('claude:check-installed', () => {
    try {
      const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
      const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
      let version: string | undefined;
      try {
        version = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
      } catch { /* ignore */ }
      return { installed: !!result, version };
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
}
