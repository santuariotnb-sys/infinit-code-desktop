import { useState, useEffect, useCallback } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.cache', 'coverage', '.turbo', 'out', '.expo']);

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

async function tryRead(filePath: string): Promise<string | null> {
  const res = await window.api.files.read(filePath);
  return res?.ok && res.data ? res.data : null;
}

// Lê arquivo e retorna primeiras N linhas
async function readHead(filePath: string, lines = 60): Promise<string | null> {
  const data = await tryRead(filePath);
  if (!data) return null;
  return data.split('\n').slice(0, lines).join('\n');
}

// Extrai exports/props resumidos de um arquivo TSX/TS
function summarizeComponent(content: string, relPath: string): string {
  const lines = content.split('\n');
  const exports: string[] = [];
  const hooks: string[] = [];
  const handlers: string[] = [];

  for (const line of lines.slice(0, 80)) {
    const l = line.trim();
    if (/^export (default function|function|const) (\w+)/.test(l)) {
      const m = l.match(/export (?:default )?(?:function|const) (\w+)/);
      if (m) exports.push(m[1]);
    }
    if (/const \[[\w,\s]+\] = use\w+/.test(l)) {
      const m = l.match(/use(\w+)\(/);
      if (m) hooks.push('use' + m[1]);
    }
    if (/(?:function|const) handle\w+/.test(l)) {
      const m = l.match(/(?:function|const) (handle\w+)/);
      if (m && handlers.length < 5) handlers.push(m[1]);
    }
  }

  const parts: string[] = [`• ${relPath}`];
  if (exports.length) parts.push(`  exports: ${exports.join(', ')}`);
  if (hooks.length) parts.push(`  hooks: ${[...new Set(hooks)].join(', ')}`);
  if (handlers.length) parts.push(`  handlers: ${handlers.join(', ')}`);
  return parts.join('\n');
}

// Extrai nomes de tabelas do schema Supabase (types.ts)
function extractSupabaseTables(content: string): string[] {
  const tables: string[] = [];
  for (const m of content.matchAll(/(\w+):\s*\{[\s\S]*?Row:/g)) {
    if (m[1] !== 'public' && m[1] !== 'Enums' && m[1] !== 'CompositeTypes') {
      tables.push(m[1]);
    }
  }
  // Fallback: busca por nomes de tabelas no formato Tables: { "nome": { ... } }
  if (tables.length === 0) {
    for (const m of content.matchAll(/"(\w+)":\s*\{[\s\S]{1,50}Row:/g)) {
      tables.push(m[1]);
    }
  }
  return [...new Set(tables)].slice(0, 30);
}

// Extrai colunas de uma tabela específica
function extractTableColumns(content: string, tableName: string): string {
  const tableMatch = content.match(new RegExp(`"${tableName}":\\s*\\{[\\s\\S]*?Row:\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  if (!tableMatch) return '';
  const cols: string[] = [];
  for (const m of tableMatch[1].matchAll(/(\w+):\s*([^;\n]+)/g)) {
    cols.push(`${m[1]}: ${m[2].trim().replace(/null \| /, '?').slice(0, 40)}`);
    if (cols.length >= 8) break;
  }
  return cols.join(', ');
}

export function useProjectIndex(projectPath: string | null, files: FileNode[]) {
  const [projectContext, setProjectContext] = useState<string>('');
  const [isIndexing, setIsIndexing] = useState(false);

  const buildIndex = useCallback(async () => {
    if (!projectPath) { setProjectContext(''); return; }
    setIsIndexing(true);

    const parts: string[] = [];
    const allPaths = flattenPaths(files, projectPath);

    // ── 1. package.json ──────────────────────────────────────────────────────
    const pkgData = await tryRead(`${projectPath}/package.json`);
    let depNames: string[] = [];
    let frameworkName = 'Desconhecido';
    let projectName = projectPath.split('/').pop() ?? 'projeto';

    if (pkgData) {
      try {
        const pkg = JSON.parse(pkgData);
        projectName = pkg.name || projectName;
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        depNames = Object.keys(allDeps);

        frameworkName =
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

        const stack = [
          depNames.includes('typescript') && 'TypeScript',
          depNames.includes('tailwindcss') && 'Tailwind CSS',
          depNames.includes('@supabase/supabase-js') && 'Supabase',
          depNames.includes('prisma') && 'Prisma',
          depNames.includes('drizzle-orm') && 'Drizzle ORM',
          (depNames.includes('@tanstack/react-query') || depNames.includes('react-query')) && 'React Query',
          depNames.includes('zustand') && 'Zustand',
          depNames.includes('jotai') && 'Jotai',
          depNames.includes('@clerk/nextjs') && 'Clerk Auth',
          depNames.includes('next-auth') && 'NextAuth',
          depNames.includes('firebase') && 'Firebase',
          (depNames.includes('react-router-dom') || depNames.includes('react-router')) && 'React Router',
          depNames.includes('zod') && 'Zod',
          depNames.includes('stripe') && 'Stripe',
          depNames.includes('mercadopago') && 'MercadoPago',
        ].filter(Boolean).join(', ');

        const scripts = pkg.scripts
          ? Object.entries(pkg.scripts as Record<string, string>)
              .slice(0, 8)
              .map(([k, v]) => `  ${k}: "${v}"`)
              .join('\n')
          : '';

        parts.push(
          `# PROJETO: ${projectName}`,
          `Framework: ${frameworkName} | Versão: ${pkg.version || '?'}`,
          stack ? `Stack: ${stack}` : '',
          `Dependências (${depNames.length} total): ${depNames.slice(0, 25).join(', ')}`,
          scripts ? `Scripts:\n${scripts}` : '',
        );
      } catch { /* JSON inválido */ }
    }

    // ── 2. CLAUDE.md do projeto ──────────────────────────────────────────────
    const claudeMd = await readHead(`${projectPath}/CLAUDE.md`, 30);
    if (claudeMd) {
      parts.push(`\n## CLAUDE.md (instruções do projeto):\n${claudeMd.trim()}`);
    }

    // ── 3. Banco de dados ────────────────────────────────────────────────────
    const dbSections: string[] = [];

    // Supabase types
    const supabaseTypePaths = [
      'src/integrations/supabase/types.ts',
      'src/lib/supabase/types.ts',
      'types/supabase.ts',
      'lib/supabase/types.ts',
    ];
    let dbResolved = false;
    for (const sp of supabaseTypePaths) {
      const content = await tryRead(`${projectPath}/${sp}`);
      if (content && content.length > 200) {
        const tables = extractSupabaseTables(content);
        if (tables.length > 0) {
          const tableDetails = tables.slice(0, 15).map(t => {
            const cols = extractTableColumns(content, t);
            return cols ? `  • ${t} (${cols})` : `  • ${t}`;
          }).join('\n');
          dbSections.push(`Supabase - Tabelas:\n${tableDetails}`);
          dbResolved = true;
          break;
        }
      }
    }

    // Prisma schema
    if (!dbResolved) {
      const prismaSchema = await readHead(`${projectPath}/prisma/schema.prisma`, 80);
      if (prismaSchema) {
        const models: string[] = [];
        for (const m of prismaSchema.matchAll(/^model (\w+) \{/gm)) models.push(m[1]);
        if (models.length) dbSections.push(`Prisma - Models: ${models.join(', ')}`);
        dbResolved = true;
      }
    }

    // Drizzle schema
    if (!dbResolved) {
      const drizzlePaths = ['src/db/schema.ts', 'db/schema.ts', 'src/lib/db/schema.ts'];
      for (const dp of drizzlePaths) {
        const content = await readHead(`${projectPath}/${dp}`, 60);
        if (content) {
          const tables: string[] = [];
          for (const m of content.matchAll(/export const (\w+) = pgTable|mysqlTable|sqliteTable/g)) {
            tables.push(m[1]);
          }
          if (tables.length) { dbSections.push(`Drizzle - Tabelas: ${tables.join(', ')}`); break; }
        }
      }
    }

    // Últimas migrations (Supabase)
    const migrationFiles = allPaths
      .filter(p => p.startsWith('supabase/migrations/') && p.endsWith('.sql'))
      .sort()
      .slice(-3);
    if (migrationFiles.length > 0) {
      const migNames = migrationFiles.map(f => f.split('/').pop()?.replace('.sql', '') ?? f);
      dbSections.push(`Últimas migrations: ${migNames.join(', ')}`);
    }

    if (dbSections.length > 0) {
      parts.push(`\n## Banco de dados:\n${dbSections.join('\n')}`);
    }

    // ── 4. Edge Functions / API Routes ───────────────────────────────────────
    const edgeFunctions: string[] = [];

    // Supabase edge functions
    const supabaseFnPaths = allPaths.filter(p =>
      p.startsWith('supabase/functions/') && p.endsWith('/index.ts')
    );
    for (const fnPath of supabaseFnPaths.slice(0, 15)) {
      const fnName = fnPath.split('/')[2];
      const head = await readHead(`${projectPath}/${fnPath}`, 20);
      const desc = head?.match(/\/\/ (.+)/)?.[1]?.slice(0, 80) ?? '';
      edgeFunctions.push(desc ? `  • ${fnName} — ${desc}` : `  • ${fnName}`);
    }

    // Next.js API routes
    const nextApiPaths = allPaths.filter(p =>
      (p.startsWith('pages/api/') || p.startsWith('app/api/')) &&
      (p.endsWith('.ts') || p.endsWith('.tsx'))
    );
    for (const apiPath of nextApiPaths.slice(0, 10)) {
      edgeFunctions.push(`  • ${apiPath}`);
    }

    if (edgeFunctions.length > 0) {
      parts.push(`\n## Edge Functions / API Routes (${edgeFunctions.length}):\n${edgeFunctions.join('\n')}`);
    }

    // ── 5. Sistema de Auth / Sessão ──────────────────────────────────────────
    const authLines: string[] = [];
    const hasSupabaseAuth = depNames.includes('@supabase/supabase-js') || depNames.includes('@supabase/ssr');
    const hasClerk = depNames.includes('@clerk/nextjs') || depNames.includes('@clerk/clerk-react');
    const hasNextAuth = depNames.includes('next-auth') || depNames.includes('@auth/core');
    const hasFirebase = depNames.includes('firebase') || depNames.includes('firebase-admin');
    const hasAuth0 = depNames.includes('@auth0/auth0-react') || depNames.includes('@auth0/nextjs-auth0');

    if (hasSupabaseAuth) authLines.push('Provider: Supabase Auth (email/password, OAuth, magic link)');
    if (hasClerk) authLines.push('Provider: Clerk (gerenciamento de usuários + sessão)');
    if (hasNextAuth) authLines.push('Provider: NextAuth / Auth.js');
    if (hasFirebase) authLines.push('Provider: Firebase Auth');
    if (hasAuth0) authLines.push('Provider: Auth0');

    // Busca arquivos de auth/contexto
    const authCandidates = [
      'src/contexts/AuthContext.tsx', 'src/context/AuthContext.tsx',
      'src/hooks/useAuth.ts', 'src/hooks/useAuth.tsx',
      'src/lib/auth.ts', 'src/utils/auth.ts',
      'src/providers/AuthProvider.tsx',
    ];
    for (const ac of authCandidates) {
      const content = await readHead(`${projectPath}/${ac}`, 40);
      if (content) {
        const exported: string[] = [];
        for (const m of content.matchAll(/export (?:const |function |default function )(\w+)/g)) {
          exported.push(m[1]);
        }
        if (exported.length) authLines.push(`Auth em ${ac}: exports ${exported.join(', ')}`);
        break;
      }
    }

    if (authLines.length > 0) {
      parts.push(`\n## Auth / Sessão:\n${authLines.map(l => `  ${l}`).join('\n')}`);
    }

    // ── 6. Páginas ───────────────────────────────────────────────────────────
    const pagePaths = allPaths.filter(p =>
      (p.startsWith('src/pages/') || p.startsWith('pages/') || p.startsWith('app/') || p.startsWith('src/app/')) &&
      (p.endsWith('.tsx') || p.endsWith('.jsx') || p.endsWith('.ts')) &&
      !p.includes('/_') && !p.includes('/api/') && !p.includes('index.ts') &&
      !p.endsWith('.test.tsx') && !p.endsWith('.spec.tsx')
    );

    if (pagePaths.length > 0) {
      const pageResults = await Promise.allSettled(
        pagePaths.slice(0, 20).map(async (p) => {
          const content = await readHead(`${projectPath}/${p}`, 50);
          return content ? summarizeComponent(content, p) : null;
        })
      );
      const pageSummaries = pageResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<string>).value);

      if (pageSummaries.length > 0) {
        parts.push(`\n## Páginas (${pageSummaries.length}):\n${pageSummaries.join('\n')}`);
      }
    }

    // ── 7. Hooks customizados ─────────────────────────────────────────────────
    const hookPaths = allPaths.filter(p =>
      (p.startsWith('src/hooks/') || p.startsWith('hooks/')) &&
      (p.endsWith('.ts') || p.endsWith('.tsx')) &&
      !p.endsWith('.test.ts') && !p.endsWith('.spec.ts')
    );

    if (hookPaths.length > 0) {
      const hookResults = await Promise.allSettled(
        hookPaths.slice(0, 20).map(async (p) => {
          const content = await readHead(`${projectPath}/${p}`, 30);
          if (!content) return null;
          const fnMatch = content.match(/export function (use\w+)/);
          const returnMatch = content.match(/return \{([^}]{1,200})\}/);
          const returns = returnMatch
            ? returnMatch[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean).slice(0, 8).join(', ')
            : '';
          const name = fnMatch?.[1] ?? p.split('/').pop()?.replace(/\.[^.]+$/, '') ?? p;
          return returns ? `  • ${name} → { ${returns} }` : `  • ${name}`;
        })
      );
      const hookSummaries = hookResults
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<string>).value);

      if (hookSummaries.length > 0) {
        parts.push(`\n## Hooks customizados (${hookSummaries.length}):\n${hookSummaries.join('\n')}`);
      }
    }

    // ── 8. Componentes principais ─────────────────────────────────────────────
    const compPaths = allPaths.filter(p =>
      (p.startsWith('src/components/') || p.startsWith('components/')) &&
      (p.endsWith('.tsx') || p.endsWith('.jsx')) &&
      !p.endsWith('.test.tsx') && !p.endsWith('.spec.tsx') &&
      !p.includes('/ui/')  // shadcn/ui auto-gerados — ignorar
    );

    if (compPaths.length > 0) {
      // Resumo compacto: só nomes, agrupados por subpasta
      const grouped: Record<string, string[]> = {};
      for (const p of compPaths.slice(0, 40)) {
        const parts2 = p.replace(/^src\/components\//, '').split('/');
        const group = parts2.length > 1 ? parts2[0] : 'root';
        const name = parts2[parts2.length - 1].replace(/\.[^.]+$/, '');
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(name);
      }
      const compSummary = Object.entries(grouped)
        .map(([g, names]) => `  ${g}: ${names.join(', ')}`)
        .join('\n');
      parts.push(`\n## Componentes (${compPaths.length}):\n${compSummary}`);
    }

    // ── 9. Rotas ─────────────────────────────────────────────────────────────
    const ROUTER_CANDIDATES = [
      'src/App.tsx', 'src/App.jsx', 'src/app.tsx', 'src/app.jsx',
      'src/router.tsx', 'src/router.jsx', 'src/routes.tsx', 'src/routes.jsx',
      'src/router/index.tsx',
    ];

    for (const rel of ROUTER_CANDIDATES) {
      const data = await tryRead(`${projectPath}/${rel}`);
      if (!data) continue;
      const routes: Array<{ path: string; element?: string }> = [];

      // path="..." com element= (regex sem backtick literal)
      const ROUTE_WITH_EL = /path=["']([^"'*]+)["'][^>]*element=\{?<(\w+)/g;
      const ROUTE_PLAIN   = /path=["']([^"'*]+)["']/g;
      for (const m of data.matchAll(ROUTE_WITH_EL)) {
        if (m[1].startsWith('/')) routes.push({ path: m[1], element: m[2] });
      }
      for (const m of data.matchAll(ROUTE_PLAIN)) {
        if (m[1].startsWith('/') && !routes.find(r => r.path === m[1])) {
          routes.push({ path: m[1] });
        }
      }

      if (routes.length > 0) {
        const unique = [...new Map(routes.map(r => [r.path, r])).values()];
        const sorted = unique.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));
        const routeLines = sorted
          .slice(0, 30)
          .map(r => r.element ? `  ${r.path} → <${r.element}>` : `  ${r.path}`)
          .join('\n');
        parts.push(`\n## Rotas (de ${rel}):\n${routeLines}`);
        break;
      }
    }

    // ── 10. Variáveis de ambiente ─────────────────────────────────────────────
    const [envEx, envLocal, envDev] = await Promise.allSettled([
      tryRead(`${projectPath}/.env.example`),
      tryRead(`${projectPath}/.env.local`),
      tryRead(`${projectPath}/.env.development`),
    ]);
    const envContent =
      (envEx.status === 'fulfilled' && envEx.value) ||
      (envLocal.status === 'fulfilled' && envLocal.value) ||
      (envDev.status === 'fulfilled' && envDev.value) || '';
    if (envContent) {
      const envKeys = envContent.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#') && l.trim())
        .map(l => l.split('=')[0].trim())
        .filter(Boolean);
      if (envKeys.length > 0) {
        parts.push(`\n## Variáveis de ambiente (${envKeys.length}):\n  ${envKeys.join(', ')}`);
      }
    }

    // ── 11. Estrutura de arquivos ─────────────────────────────────────────────
    if (allPaths.length > 0) {
      const tree = allPaths.slice(0, 100).join('\n');
      parts.push(`\n## Estrutura de arquivos (${allPaths.length} itens):\n${tree}`);
    }

    const ctx = parts.filter(Boolean).join('\n');
    setProjectContext(ctx);
    setIsIndexing(false);
  }, [projectPath, files]);

  useEffect(() => {
    buildIndex();
  }, [buildIndex]);

  return { projectContext, isIndexing, reindex: buildIndex };
}
