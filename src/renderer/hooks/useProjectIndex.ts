import { useState, useEffect, useCallback } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache', 'coverage', '.turbo', 'out']);

function flattenPaths(nodes: FileNode[], projectPath: string, depth = 0): string[] {
  if (depth > 5) return [];
  const paths: string[] = [];
  for (const node of nodes) {
    if (IGNORE.has(node.name) || node.name.startsWith('.DS_Store')) continue;
    const rel = node.path.replace(projectPath + '/', '');
    paths.push(node.type === 'folder' ? `${rel}/` : rel);
    if (node.type === 'folder' && node.children && depth < 4) {
      paths.push(...flattenPaths(node.children, projectPath, depth + 1));
    }
  }
  return paths;
}

const ROUTER_CANDIDATES = [
  'src/App.tsx', 'src/App.jsx', 'src/app.tsx', 'src/app.jsx',
  'src/router.tsx', 'src/router.jsx', 'src/routes.tsx', 'src/routes.jsx',
  'src/router/index.tsx', 'app/routes.ts', 'app/routes.tsx',
];

export function useProjectIndex(projectPath: string | null, files: FileNode[]) {
  const [projectContext, setProjectContext] = useState<string>('');
  const [isIndexing, setIsIndexing] = useState(false);

  const buildIndex = useCallback(async () => {
    if (!projectPath) { setProjectContext(''); return; }
    setIsIndexing(true);

    const parts: string[] = [];

    // ── 1. package.json ───────────────────────────────────────────────────────
    const pkgRes = await window.api.files.read(`${projectPath}/package.json`);
    if (pkgRes?.ok && pkgRes.data) {
      try {
        const pkg = JSON.parse(pkgRes.data);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        const depNames = Object.keys(allDeps);

        const framework =
          depNames.includes('next') ? 'Next.js' :
          depNames.includes('@vitejs/plugin-react') || depNames.includes('@vitejs/plugin-react-swc') ? 'Vite + React' :
          depNames.includes('vite') ? 'Vite' :
          depNames.includes('react-scripts') ? 'Create React App' :
          depNames.includes('@remix-run/react') ? 'Remix' :
          depNames.includes('astro') ? 'Astro' :
          depNames.includes('nuxt') ? 'Nuxt' :
          depNames.includes('vue') ? 'Vue' :
          depNames.includes('svelte') ? 'Svelte' :
          depNames.includes('@angular/core') ? 'Angular' :
          depNames.includes('react') ? 'React' : 'Desconhecido';

        const devTools = [
          depNames.includes('typescript') && 'TypeScript',
          depNames.includes('tailwindcss') && 'Tailwind CSS',
          (depNames.includes('vitest') || depNames.includes('jest')) && 'testes',
          depNames.includes('@supabase/supabase-js') && 'Supabase',
          depNames.includes('prisma') && 'Prisma',
          depNames.includes('drizzle-orm') && 'Drizzle',
          depNames.includes('trpc') && 'tRPC',
          (depNames.includes('@tanstack/react-query') || depNames.includes('react-query')) && 'React Query',
          depNames.includes('zustand') && 'Zustand',
          depNames.includes('jotai') && 'Jotai',
          (depNames.includes('react-router-dom') || depNames.includes('react-router')) && 'React Router',
        ].filter(Boolean).join(', ');

        const scripts = pkg.scripts
          ? Object.entries(pkg.scripts as Record<string, string>)
              .map(([k, v]) => `  ${k}: "${v}"`)
              .join('\n')
          : '';

        parts.push(
          `# PROJETO: ${pkg.name || projectPath.split('/').pop()}`,
          `Versão: ${pkg.version || '?'} | Framework: ${framework}`,
          devTools ? `Stack: ${devTools}` : '',
          `Dependências (${depNames.length}): ${depNames.slice(0, 30).join(', ')}`,
          scripts ? `Scripts npm:\n${scripts}` : '',
        );
      } catch { /* JSON inválido */ }
    }

    // ── 2. README ─────────────────────────────────────────────────────────────
    const readmeRes = await window.api.files.read(`${projectPath}/README.md`);
    if (readmeRes?.ok && readmeRes.data) {
      const readme = readmeRes.data.split('\n').slice(0, 25).join('\n').trim();
      if (readme) parts.push(`\n## README:\n${readme}`);
    }

    // ── 3. Árvore de arquivos ─────────────────────────────────────────────────
    if (files.length > 0) {
      const allPaths = flattenPaths(files, projectPath);
      const tree = allPaths.slice(0, 120).join('\n');
      parts.push(`\n## Estrutura de arquivos (${allPaths.length} itens):\n${tree}`);
    }

    // ── 4. Rotas detectadas ───────────────────────────────────────────────────
    for (const rel of ROUTER_CANDIDATES) {
      const res = await window.api.files.read(`${projectPath}/${rel}`);
      if (!res?.ok || !res.data) continue;
      const routes: string[] = [];
      for (const m of res.data.matchAll(/path=["'`]([^"'`*]+)["'`]/g)) {
        if (m[1].startsWith('/')) routes.push(m[1]);
      }
      for (const m of res.data.matchAll(/path:\s*["'`]([^"'`*]+)["'`]/g)) {
        if (m[1].startsWith('/')) routes.push(m[1]);
      }
      if (routes.length > 0) {
        const unique = [...new Set(routes)].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
        parts.push(`\n## Rotas (de ${rel}):\n${unique.join('\n')}`);
        break;
      }
    }

    // ── 5. Variáveis de ambiente ──────────────────────────────────────────────
    const envExRes = await window.api.files.read(`${projectPath}/.env.example`);
    const envLocalRes = await window.api.files.read(`${projectPath}/.env.local`);
    const envContent = envExRes?.data || envLocalRes?.data || '';
    if (envContent) {
      const envKeys = envContent.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => l.split('=')[0]).filter(Boolean);
      if (envKeys.length > 0) parts.push(`\n## Variáveis de ambiente: ${envKeys.join(', ')}`);
    }

    const ctx = parts.filter(Boolean).join('\n');
    setProjectContext(ctx);
    setIsIndexing(false);
  }, [projectPath, files]);

  useEffect(() => {
    buildIndex();
  }, [buildIndex]);

  return { projectContext, isIndexing };
}
