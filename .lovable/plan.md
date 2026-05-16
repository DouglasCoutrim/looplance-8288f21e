
# Corrigir carrossel de "Destaques Recentes" na Home

## Problema

O carrossel da Home (`src/routes/index.tsx`) hoje consome `useGlobalReplays`, que agrega replays de **vários** Supabase externos (um por arena) e faz `slice(0,3)` no resultado mesclado. Quando uma arena demora a responder, ou quando o cliente externo cacheia, o "lance que acabou de acontecer" pode aparecer atrás de vídeos antigos, sem realtime confiável.

A correção isola o carrossel para usar **uma única fonte verdadeira, ordenada estritamente**, com Realtime dedicado e formatação no fuso do navegador.

## Decisão de fonte de dados

Usar a tabela agregada `public.global_replays` do Supabase principal:

- Já é populada por trigger (`sync_global_replay`) sempre que um vídeo entra em `videos`, então reflete o que o backend faz upload.
- Tem RLS `public_read = true` → não exige login.
- Permite um único `subscribe()` em vez de N canais (um por arena).
- Tem `video_url`, `thumbnail_url`, `arena_*`, `court_*`, `created_at` → tudo que o carrossel precisa.

Observação: se o pipeline Python publica direto no Supabase externo da arena (não no principal), o trigger não dispara. Confirmo isso na investigação inicial. Se for o caso, o carrossel ainda assim renderiza corretamente para qualquer fonte que **insira em `global_replays`** — alternativa documentada abaixo.

## Mudanças

### 1. Novo hook `src/hooks/use-top-replays.ts`

- Query inicial:
  ```ts
  supabase.from("global_replays")
    .select("id, video_id, arena_id, arena_name, arena_slug, arena_primary_color, arena_logo_url, court_id, court_name, title, video_url, thumbnail_url, created_at")
    .order("created_at", { ascending: false })
    .limit(3);
  ```
- Realtime: `supabase.channel("home-top-replays").on("postgres_changes", { event: "INSERT", schema: "public", table: "global_replays" }, …)` — ao receber, prepende e corta para 3.
- Também escuta `UPDATE` (caso `video_url` mude) e `DELETE`.
- Cleanup com `removeChannel` no unmount.
- Retorna `{ replays, loading }`.

### 2. Atualizar `src/routes/index.tsx`

- Trocar `useGlobalReplays` → `useTopReplays` **apenas** para o bloco "Destaques Recentes" (carrossel). Manter `useGlobalReplays` para o feed "Replays recentes" abaixo (até confirmar que `global_replays` cobre tudo — segunda fase).
- `topReplays` vem direto do novo hook (já é `limit(3)`, sem `slice`).
- Formatação de data no fuso local do navegador:
  ```ts
  new Date(r.created_at).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  ```
  Manter `formatDistanceToNow` (já é relativo ao "agora" local) e adicionar tooltip `title={...}` com a data absoluta no horário de Brasília.

### 3. URL do player a partir do bucket público

`src/lib/replays.ts` já existe e expõe `resolveReplayUrl(value)` apontando para `https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/`. O carrossel já usa essa função para `video_url` e `thumbnail_url` — manter. Garantir que **qualquer novo render** (incluindo realtime) passe pela mesma função, sem montar URL manualmente em outro lugar.

### 4. Ativar realtime no Postgres (migração)

Verificar se `global_replays` está na publication `supabase_realtime`. Se não, criar migração:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_replays;
ALTER TABLE public.global_replays REPLICA IDENTITY FULL;
```
(executada via tool de migração, com aprovação do usuário).

## Arquivos afetados

- **novo**: `src/hooks/use-top-replays.ts`
- **editado**: `src/routes/index.tsx` (apenas a seção "Destaques Recentes" + formatação de data)
- **possível migração**: habilitar realtime em `global_replays`

## Critério de aceite

1. Abrir Home → os 3 cards mostram os 3 vídeos com `created_at` mais recente, sem exceção.
2. Inserir um novo replay no banco → ele aparece como primeiro card em < 2s, sem F5.
3. Datas exibidas batem com o horário de Brasília do usuário.
4. URLs dos vídeos resolvem para `https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/<arquivo>`.

## Pergunta antes de implementar

O backend hoje insere os vídeos finais em:
- (A) `public.videos` do Supabase **principal** (que via trigger popula `global_replays`), ou
- (B) tabela `replays` do Supabase **externo de cada arena** (multi-tenant)?

Se for (B), `global_replays` não recebe os inserts e o carrossel fica vazio. Nesse caso, a fonte do hook deve ser a `replays` da arena (como hoje), e a correção será aplicada lá — mantendo a estrutura do plano. Confirma qual é o fluxo atual?
