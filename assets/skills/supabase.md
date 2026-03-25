# Skill: Integração Supabase

## Quando usar
Pedidos como: "banco de dados", "supabase", "tabela", "RLS", "auth", "edge function", "storage", "query"

## Setup do cliente

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

## Criar tabela (SQL)

```sql
CREATE TABLE nome_tabela (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- campos aqui
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- SEMPRE criar RLS
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

-- Policy: usuário vê só seus dados
CREATE POLICY "Users read own data"
  ON nome_tabela FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own data"
  ON nome_tabela FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own data"
  ON nome_tabela FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own data"
  ON nome_tabela FOR DELETE
  USING (auth.uid() = user_id);

-- Index nos campos que filtram
CREATE INDEX idx_nome_tabela_user ON nome_tabela(user_id);
```

## Query patterns

```typescript
// SELECT com filtro
const { data, error } = await supabase
  .from('tabela')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);

// INSERT
const { data, error } = await supabase
  .from('tabela')
  .insert({ campo1: valor1, user_id: userId })
  .select()
  .single();

// UPDATE
const { error } = await supabase
  .from('tabela')
  .update({ campo1: novoValor })
  .eq('id', itemId);

// DELETE
const { error } = await supabase
  .from('tabela')
  .delete()
  .eq('id', itemId);
```

## Edge Function

```typescript
// supabase/functions/nome-funcao/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data } = await req.json();
    // lógica aqui

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

## Regras

- SEMPRE habilitar RLS em toda tabela
- NUNCA usar service_role key no frontend
- SEMPRE ter created_at e updated_at
- UUID para primary keys, não serial
- Referências com ON DELETE CASCADE quando faz sentido
- Index nos campos usados em WHERE e ORDER BY
- Edge Functions para lógica que não pode rodar no client
