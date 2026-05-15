## Objetivo

Cada arena terá seu próprio projeto Supabase (URL + anon key + service key) e um bucket de vídeos próprio. O Super Admin define globalmente (ou por arena) quantos dias os vídeos ficam armazenados — depois disso o sistema apaga automaticamente os arquivos do bucket externo e os registros da tabela `videos` daquela arena.

## O que muda

### 1. Cadastro da Arena (Super Admin)
Na tela `admin.arena.$id.tsx`, aba **Conexão**, ampliar os campos já existentes:
- `supabase_url` (já existe)
- `supabase_anon_key` (já existe — usado pelo app no browser para listar vídeos)
- `supabase_service_key` (já existe na tabela, mas não é usado — passa a ser obrigatório para apagar arquivos)
- `videos_bucket` (novo — nome do bucket no projeto externo, default `replays`)
- `retention_days` (novo — sobrescreve o global; null = usar o global)

A `service_key` **nunca** vai para o browser. Fica só no banco da Lovable Cloud, lida apenas dentro de server functions.

### 2. Configuração Global (Super Admin)
Nova seção em `admin.infra.tsx` (ou nova rota `admin.retention.tsx`):
- `default_retention_days` (ex: 30)
- Botão "Rodar limpeza agora" para teste

Armazenado em uma tabela nova `app_settings` (key/value, só superadmin).

### 3. Leitura dos vídeos (já parcialmente feita)
Continua como hoje: o app usa `getArenaClient(url, anon_key)` para listar vídeos e arquivos do bucket externo da arena. Sem alteração de comportamento — só passa a respeitar `videos_bucket` da arena em vez do hardcoded `replays`.

### 4. Limpeza automática (retention)
Server route pública `src/routes/api/public/hooks/cleanup-videos.ts`:
- Busca todas as arenas com `supabase_url` + `supabase_service_key` configurados
- Para cada arena, calcula `cutoff = now() - retention_days` (arena ou global)
- Cria client com a service key da arena
- Lista registros em `videos` (tabela do projeto externo) com `created_at < cutoff`
- Apaga os arquivos do bucket (`storage.from(bucket).remove([...])`)
- Apaga os registros da tabela `videos` externa
- Loga resumo (arena, quantidade apagada, erros)

Agendado via `pg_cron` + `pg_net` rodando 1x/dia às 03:00. Autenticação via header `apikey` com a anon key (padrão Lovable Cloud).

### 5. Segurança
- `supabase_service_key` removido de qualquer SELECT que vá para o browser. A query atual em `admin.arena.$id.tsx` já não pode trazer esse campo — passa a ser lida apenas em server functions.
- Coluna continua na tabela `arenas`, mas RLS já restringe SELECT a superadmin/admin da arena. Mesmo assim, o frontend nunca vai pedir esse campo.
- Save da arena (incluindo service key) passa a ser feito por uma server function `updateArenaConnection` com `requireSupabaseAuth` + checagem de superadmin, para que a service key trafegue só server-side.

## Detalhes técnicos

**Migrations necessárias:**
```sql
ALTER TABLE arenas
  ADD COLUMN videos_bucket text DEFAULT 'replays',
  ADD COLUMN retention_days integer;

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_settings_super ON app_settings FOR ALL
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

INSERT INTO app_settings(key, value) VALUES ('default_retention_days', '30'::jsonb);
```

**Arquivos a criar:**
- `src/lib/arena-admin.functions.ts` — `updateArenaConnection`, `runVideoCleanup` (server fns, só superadmin)
- `src/routes/api/public/hooks/cleanup-videos.ts` — endpoint chamado pelo cron
- `src/routes/admin.retention.tsx` (ou seção em `admin.infra.tsx`) — UI da config global + botão "rodar agora"

**Arquivos a editar:**
- `src/routes/admin.arena.$id.tsx` — aba Conexão ganha campos `videos_bucket`, `retention_days`, `supabase_service_key` (input password, write-only); save via server fn
- `src/lib/arena-client.ts` — sem mudança
- `src/routes/arena.$id.tsx` / `meus-replays.tsx` — usar `videos_bucket` da arena ao montar URL pública (quando aplicável)

**Cron (via supabase insert tool após deploy):**
```sql
SELECT cron.schedule('cleanup-arena-videos', '0 3 * * *', $$
  SELECT net.http_post(
    url := 'https://project--8299bd7c-d78f-407f-9c10-87e7f45cb569.lovable.app/api/public/hooks/cleanup-videos',
    headers := '{"Content-Type":"application/json","apikey":"<ANON>"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
```

## O que NÃO muda
- Pipeline Python continua gravando no Supabase externo da arena (já é o comportamento atual).
- Lovable Cloud continua sendo a fonte única de auth, roles, arenas, câmeras, botões, replay_jobs.
- Tabela `videos` da Lovable Cloud continua existindo como fallback para arenas sem Supabase próprio.
