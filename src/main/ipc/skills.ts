import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface SkillFile {
  id: string;
  name: string;
  content: string;
  source: 'bundled' | 'custom';
}

function getBundledSkillsPath(): string {
  // Dev: assets/skills/  |  Prod: resources/assets/skills/
  const devPath = path.join(__dirname, '../../../assets/skills');
  if (fs.existsSync(devPath)) return devPath;

  const prodPath = path.join(process.resourcesPath, 'assets/skills');
  if (fs.existsSync(prodPath)) return prodPath;

  // Fallback em ~/.infinit-code/skills
  const fallback = path.join(os.homedir(), '.infinit-code', 'skills');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function loadFromDir(dir: string, source: 'bundled' | 'custom'): SkillFile[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .flatMap(file => {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const id = file.replace('.md', '');
        const nameMatch = content.match(/^#\s+(?:Skill:\s*)?(.+)/m);
        const name = nameMatch?.[1]?.trim() || id;
        return [{ id, name, content, source }];
      } catch {
        return [];
      }
    });
}

export function registerSkillsHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('skills:load', async (_event, projectPath?: string) => {
    try {
      const bundled = loadFromDir(getBundledSkillsPath(), 'bundled');

      let custom: SkillFile[] = [];
      if (projectPath) {
        custom = loadFromDir(path.join(projectPath, '.infinit', 'skills'), 'custom');
      }

      // Custom sobrescreve bundled com mesmo ID
      const merged = new Map<string, SkillFile>();
      for (const s of bundled) merged.set(s.id, s);
      for (const s of custom) merged.set(s.id, s);

      return Array.from(merged.values());
    } catch (error) {
      console.error('[skills:load]', error);
      return [];
    }
  });

  ipcMain.handle('skills:list', async (_event, projectPath?: string) => {
    try {
      const bundled = loadFromDir(getBundledSkillsPath(), 'bundled');
      let custom: SkillFile[] = [];
      if (projectPath) {
        custom = loadFromDir(path.join(projectPath, '.infinit', 'skills'), 'custom');
      }
      const merged = new Map<string, { id: string; name: string; source: string }>();
      for (const s of bundled) merged.set(s.id, { id: s.id, name: s.name, source: s.source });
      for (const s of custom) merged.set(s.id, { id: s.id, name: s.name, source: s.source });
      return Array.from(merged.values());
    } catch {
      return [];
    }
  });

  ipcMain.handle('skills:save', async (_event, projectPath: string, id: string, content: string) => {
    try {
      const dir = path.join(projectPath, '.infinit', 'skills');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${id}.md`), content, 'utf-8');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });
}
