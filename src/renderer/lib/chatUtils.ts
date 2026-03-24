import { basename } from '../utils/path';

export interface ActionCard {
  id: string;
  type: 'file' | 'command' | 'url';
  label: string;
  value: string;
}

export function parseActionCards(output: string): ActionCard[] {
  const cards: ActionCard[] = [];
  const lines = output.split('\n').slice(-40);
  for (const line of lines) {
    const fileMatch =
      line.match(/(?:Write|Edit|Read)\(\s*["']?([^"')]+\.[a-z]{1,6})["']?\s*\)/i) ||
      line.match(/(?:Writing to|Created|Edited?|Saved?)\s+((?:src|app|pages|components|lib)\/[^\s]+|[^\s]+\.[a-z]{1,5})/i);
    if (fileMatch && fileMatch[1] && !fileMatch[1].includes('*')) {
      const fp = fileMatch[1].trim();
      cards.push({ id: fp, type: 'file', label: `📄 ${basename(fp)}`, value: fp });
    }
    const cmdMatch = line.match(/^\s*\$\s+(.+)$/) || line.match(/Bash\(\s*["']?([^"'\n)]{3,80})["']?\s*\)/);
    if (cmdMatch && cmdMatch[1]) {
      cards.push({ id: cmdMatch[1].trim(), type: 'command', label: `$ ${cmdMatch[1].trim().slice(0, 50)}`, value: cmdMatch[1].trim() });
    }
    const urlMatch = line.match(/https?:\/\/localhost:(\d{4,5})/);
    if (urlMatch) {
      cards.push({ id: urlMatch[0], type: 'url', label: `🌐 localhost:${urlMatch[1]}`, value: urlMatch[0] });
    }
  }
  const seen = new Set<string>();
  return cards.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }).slice(0, 5);
}

export function getSuggestions(
  activeFile: { path: string; content: string } | null,
  terminalOutput: string,
): string[] {
  if (!activeFile) {
    if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', 'Explique o erro'];
    return [];
  }
  const ext = activeFile.path.split('.').pop() || '';
  if (['tsx', 'jsx'].includes(ext)) {
    const base = ['Adicione TypeScript types', 'Extraia componente', 'Adicione testes'];
    if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', ...base];
    if (/localhost:/i.test(terminalOutput)) return ['Analise a UI atual', 'Melhore o design', ...base];
    return base;
  }
  if (['ts', 'js'].includes(ext)) return ['Adicione tratamento de erro', 'Melhore a performance', 'Adicione validação Zod'];
  if (/error:/i.test(terminalOutput)) return ['Corrija esse erro', 'Explique o erro', 'Mostre o stack trace'];
  return [];
}
