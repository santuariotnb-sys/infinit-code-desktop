import { BrowserWindow, shell } from 'electron';
import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ElectronStore from 'electron-store';

const store = new ElectronStore({ name: 'infinit-setup' });

// Fix PATH para Electron no Mac — não herda PATH do shell do usuário
const EXTRA_PATHS = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const ENV_WITH_PATH = {
  ...process.env,
  PATH: `${process.env.PATH || ''}:${EXTRA_PATHS}`,
};

function progress(mainWindow: BrowserWindow, step: string, pct: number, msg: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log(`[auto-setup] step=${step} pct=${pct} msg=${msg}`);
    mainWindow.webContents.send('setup:progress', { step, pct, msg });
  }
}

function checkNode(): boolean {
  try {
    const version = execSync('node --version', { encoding: 'utf-8', timeout: 5000, env: ENV_WITH_PATH }).trim();
    const major = parseInt(version.replace('v', '').split('.')[0], 10);
    console.log(`[auto-setup] node version: ${version}, major: ${major}`);
    return major >= 18;
  } catch (e) {
    console.error('[auto-setup] checkNode failed:', e);
    return false;
  }
}

function checkGit(): boolean {
  try {
    const out = execSync('git --version', { encoding: 'utf-8', timeout: 5000, env: ENV_WITH_PATH }).trim();
    console.log(`[auto-setup] git: ${out}`);
    return true;
  } catch (e) {
    console.error('[auto-setup] checkGit failed:', e);
    return false;
  }
}

function checkClaude(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const out = execSync(cmd, { encoding: 'utf-8', timeout: 5000, env: ENV_WITH_PATH }).trim();
    console.log(`[auto-setup] claude path: ${out}`);
    return true;
  } catch (e) {
    console.error('[auto-setup] checkClaude failed:', e);
    return false;
  }
}

function installClaude(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('[auto-setup] installing claude-code...');
    exec('npm install -g @anthropic-ai/claude-code', { timeout: 120000, env: ENV_WITH_PATH }, (error) => {
      if (error) {
        console.error('[auto-setup] npm install failed, trying sudo:', error.message);
        if (process.platform !== 'win32') {
          exec('sudo npm install -g @anthropic-ai/claude-code', { timeout: 120000, env: ENV_WITH_PATH }, (err2) => {
            resolve(!err2);
          });
        } else {
          resolve(false);
        }
      } else {
        console.log('[auto-setup] claude-code installed successfully');
        resolve(true);
      }
    });
  });
}

function waitForGit(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (checkGit()) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 5000);
    };
    check();
  });
}

function installSkills(): void {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const skills: Record<string, string> = {
    'frontend-design.md': '---\nname: frontend-design\n---\n\nVocê é especialista em frontend design com React e Tailwind CSS.',
    'ui-ux-pro-max.md': '---\nname: ui-ux-pro-max\n---\n\nDesign intelligence para UI/UX profissional.',
    'supabase-agent.md': '---\nname: supabase-agent\n---\n\nEspecialista Supabase para banco de dados e auth.',
    'landing-page.md': '---\nname: landing-page\n---\n\nCria landing pages de alta conversão.',
    'code-quality.md': '---\nname: code-quality\n---\n\nGarante qualidade de código com boas práticas.',
  };

  for (const [filename, content] of Object.entries(skills)) {
    fs.writeFileSync(path.join(skillsDir, filename), content, 'utf-8');
  }
}

function writeClaudeSettings(): void {
  const settingsDir = path.join(os.homedir(), '.claude');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  const settingsPath = path.join(settingsDir, 'settings.json');
  const settings = {
    language: 'pt-BR',
    theme: 'dark',
    model: 'claude-sonnet-4-6',
    verbose: false,
  };

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function runAutoSetup(mainWindow: BrowserWindow): Promise<void> {
  console.log('[auto-setup] starting, setup-complete:', store.get('setup-complete'));

  if (store.get('setup-complete')) {
    console.log('[auto-setup] already complete, emitting setup:complete');
    mainWindow.webContents.send('setup:complete');
    return;
  }

  // Step 1: Node.js
  progress(mainWindow, 'node', 0, 'Verificando Node.js...');
  const nodeOk = checkNode();
  if (!nodeOk) {
    shell.openExternal('https://nodejs.org/en/download');
    mainWindow.webContents.send('setup:need-node');
    return;
  }
  progress(mainWindow, 'node', 20, 'Node.js ✓');

  // Step 2: Git
  progress(mainWindow, 'git', 20, 'Verificando Git...');
  const gitOk = checkGit();
  if (!gitOk) {
    if (process.platform === 'darwin') {
      exec('xcode-select --install');
    } else {
      shell.openExternal('https://git-scm.com/downloads');
    }
    progress(mainWindow, 'git', 25, 'Instalando Git... aguarde');
    await waitForGit(300000);
  }
  progress(mainWindow, 'git', 40, 'Git ✓');

  // Step 3: Claude Code
  progress(mainWindow, 'claude', 40, 'Verificando Claude Code...');
  const claudeOk = checkClaude();
  if (!claudeOk) {
    progress(mainWindow, 'claude', 45, 'Instalando Claude Code...');
    const installed = await installClaude();
    if (!installed) {
      progress(mainWindow, 'claude', 45, 'Erro ao instalar Claude Code. Instale manualmente: npm i -g @anthropic-ai/claude-code');
      return;
    }
  }
  progress(mainWindow, 'claude', 60, 'Claude Code ✓');

  // Step 4: Skills
  if (!store.get('skills-installed')) {
    progress(mainWindow, 'skills', 60, 'Configurando skills...');
    installSkills();
    store.set('skills-installed', true);
  }
  progress(mainWindow, 'skills', 80, 'Skills ✓');

  // Step 5: Claude Settings
  if (!store.get('claude-configured')) {
    progress(mainWindow, 'config', 80, 'Configurando Claude Code...');
    writeClaudeSettings();
    store.set('claude-configured', true);
  }
  progress(mainWindow, 'config', 90, 'Configurado ✓');

  progress(mainWindow, 'done', 100, 'Pronto!');
  store.set('setup-complete', true);
  mainWindow.webContents.send('setup:complete');
}
