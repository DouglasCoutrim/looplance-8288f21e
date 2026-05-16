# Plano: Replays direto do Supabase externo (Opção B)

O agente continua gravando o MP4 e o registro no Supabase **externo** de cada arena (`htirxluqufyexmpuhhbt`, tabela `replays`, bucket `replays`). A Home da plataforma deixa de ler `global_replays` do banco central e passa a consultar **N bancos externos em paralelo**, agregando e ouvindo Realtime em cada um.

## Pré-requisito no Supabase externo (você roda 1x por arena)

Como a RLS provavelmente não permite leitura anônima, eu vou te entregar o SQL para colar no SQL Editor do Supabase externo:

```sql
alter table public.replays enable row level security;
create policy "replays_public_read"
  on public.replays for select
  to anon, authenticated
  using (true);

-- Realtime
alter publication supabase_realtime add table public.replays;
alter table public.replays replica identity full;

-- Bucket público (se ainda não estiver)
update storage.buckets set public = true where id = 'replays';
```

Sem isso, a anon key não enxerga nada e o carrossel continua vazio.

## Mudanças no código (plataforma)

1. **`src/lib/arena-client.ts`** (já existe parcialmente): factory `getArenaSupabase(url, anonKey)` que cacheia um client por arena. Sem persistência de sessão (anon-only).

2. **Novo hook `src/hooks/use-global-replays.ts`**:
   - Server function `listArenasWithEndpoint()` retorna `[{ id, name, slug, primary_color, logo_url, supabase_url, supabase_anon_key }]` das arenas `active=true` que tenham `supabase_url` e `supabase_anon_key` preenchidos.
   - No cliente, para cada arena: `client.from('replays').select('id, quadra_id, video_url, thumb_url, created_at').order('created_at', { ascending: false }).limit(20)`.
   - Junta todas as listas, ordena por `created_at desc`, retorna top N (ex.: 30).
   - Para cada arena, abre um canal Realtime `replays-{arenaId}` em `postgres_changes` (INSERT em `public.replays`); ao receber, faz prepend do novo item com os metadados da arena e mantém o array ordenado.

3. **`src/routes/index.tsx`**: troca a query atual de `global_replays` pelo hook acima. Mantém:
   - `.slice(0, 3)` para o carrossel.
   - `formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })` (UTC → local).
   - Quando `arena_logo_url`/`primary_color` faltarem, usa fallback do registro da arena.

4. **Endpoint público que o agente já espera (`/api/public/agent/config`)**: nada muda aqui — continua servindo `supabase_url`, `supabase_service_key` etc. para o agente seguir gravando no externo.

5. **Limpeza**: `global_replays`, trigger `sync_global_replay` e o endpoint `/api/public/ingest/replay` ficam **inativos mas preservados** (podem ser reusados depois para fallback/analytics). Não vou apagar nada nesta passagem.

## Trade-offs aceitos (importante)

- A `supabase_anon_key` da arena vai para o **navegador**. Anon key é desenhada para isso, mas exige que a RLS do externo libere apenas `SELECT` no que pode ser público (ex.: `replays`, talvez `quadras`). **Não habilite** policy pública em tabelas sensíveis (usuários, tokens, etc.).
- Cada arena ativa = 1 conexão Realtime no navegador. Com 20+ arenas isso pesa; nesse caso a gente migra para C (POST leve no central) depois.
- Latência do feed = latência do banco externo mais lento.

## Esquema visual

```text
Botão físico ─▶ agente (mini-PC) ─▶ Supabase externo da arena
                                        │
                                        ▼
                              tabela replays (INSERT)
                                        │
                                        ▼  Realtime
        Plataforma (Home) ◀── canal por arena, agrega top 30
```

## Detalhes técnicos

- Server fn `listArenasWithEndpoint` usa `supabaseAdmin` (server-side) e devolve a `anon_key` — OK porque é publishable.
- O query no externo seleciona só colunas existentes: `id, quadra_id, video_url, thumb_url, created_at`. Sem `title`, `arena_*` — esses campos vêm da arena conhecida no frontend.
- Realtime channel: `channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replays' }, handler).subscribe()`.
- `video_url` no externo é caminho dentro do bucket `replays`; o frontend monta a URL pública via `client.storage.from('replays').getPublicUrl(path)` se não vier URL absoluta.

## Entregáveis nesta implementação

- SQL para você rodar no Supabase externo (ver acima).
- `src/lib/arena-client.ts` ajustado.
- `src/hooks/use-global-replays.ts` novo.
- `src/routes/index.tsx` consumindo o hook, com Realtime e tempo local.

Aprova para eu implementar?