## Objetivo

Fazer o frontend avisar o agente da arena sempre que houver mudança em **arenas, quadras, câmeras, placas zero‑delay, botões ou vínculos quadra↔câmera**, para o agente recarregar o `/api/public/agent/config` imediatamente e gerar vídeos já mapeados nos IDs corretos.

## Abordagem (duas camadas, complementares)

1. **Push (instantâneo) via webhook** — cada arena cadastra a URL HTTP do seu agente; o backend Lovable envia um POST de invalidação sempre que algo muda.
2. **Pull (fallback) por versão** — o endpoint `/api/public/agent/config` passa a retornar `config_version` (timestamp/inteiro). O agente já revalida a cada 60s e compara versão — se mudou, recarrega.

Assim, mesmo se o webhook falhar (rede do clube, agente offline no momento), na próxima revalidação o agente pega a config nova sozinho.

## Mudanças no banco

Tabela `arenas` — adicionar:
- `agent_webhook_url text` (URL HTTPS do agente, ex.: `https://arena-x.local:8443/agent/reload` ou um túnel)
- `agent_webhook_secret text` (segredo p/ HMAC do payload)
- `config_version bigint not null default 1`

Trigger `bump_arena_config_version()` que incrementa `arenas.config_version` e atualiza `updated_at` sempre que houver INSERT/UPDATE/DELETE em:
`courts`, `cameras`, `court_cameras`, `arena_buttons`, `zero_delay_boards`, e em colunas relevantes de `arenas` (nome, slug, bucket, retention, supabase_*).

## Backend (TanStack Start)

1. `src/lib/agent-notify.server.ts` — helper `notifyAgent(arenaId, reason)`:
   - lê `agent_webhook_url`, `agent_webhook_secret`, `config_version` da arena;
   - envia POST JSON `{ arena_id, reason, config_version, ts }` com header `X-Agent-Signature: sha256=<hmac>`;
   - timeout 3s, 2 retries com backoff; falhas viram log (não bloqueia UI — o pull cobre).

2. Server fn `notifyArenaAgent` (`src/lib/agent-notify.functions.ts`) com `requireSupabaseAuth` + checagem `is_arena_admin || superadmin`. Chamada pelo frontend após cada save de:
   - criar/renomear/excluir quadra
   - criar/editar/excluir câmera
   - vincular/desvincular câmera↔botão
   - vincular/desvincular quadra↔câmera
   - criar/excluir placa ARC‑968
   - editar conexão da arena (já existe em `updateArenaConnection` — chamar `notifyArenaAgent` no fim)

3. `src/routes/api/public/agent.config.ts` — passar a incluir `config_version` no JSON de resposta.

4. Novo campo no admin (página de gerenciamento da arena, aba **Conexão**): inputs para `agent_webhook_url` e `agent_webhook_secret` (este último write‑only, salvo via `updateArenaConnection`).

## Frontend

- `src/routes/admin.arena.$id.tsx`
  - Aba **Conexão**: campos para URL e segredo do webhook do agente.
  - Aba **Quadras** (`CourtsCard`): após `add/remove/rename/setCourtCamera` → `notifyArenaAgent({ arenaId, reason })`.
  - Aba **Câmeras**: após qualquer mutação → `notifyArenaAgent`.
  - Aba **Placas/Botões**: idem.

Helper único `useNotifyAgent(arenaId)` para não repetir código.

## Contrato do webhook (documentar no prompt do Antigravity)

```
POST {agent_webhook_url}
Headers:
  Content-Type: application/json
  X-Agent-Signature: sha256=<hex hmac do body com agent_webhook_secret>
Body:
  { "arena_id": "...", "reason": "courts.updated", "config_version": 42, "ts": "2026-..." }
Resposta esperada: 2xx (agente dispara reload do /agent/config).
```

Razões padronizadas: `arena.updated`, `courts.updated`, `cameras.updated`, `court_cameras.updated`, `boards.updated`, `buttons.updated`.

## Critério de aceite

- Cadastrar uma quadra nova → em ≤2s o agente recarrega config; próximo replay já sai com `court_id` correto e `court_name` aparecendo no carrossel.
- Sem webhook configurado (ou agente offline): em ≤60s o pull pega `config_version` nova e recarrega.
- Erros de webhook ficam só no log; o admin não vê falha de UI.

## Arquivos a criar/editar

- migration: colunas + trigger + função `bump_arena_config_version`
- novo: `src/lib/agent-notify.server.ts`, `src/lib/agent-notify.functions.ts`
- editar: `src/routes/api/public/agent.config.ts` (incluir `config_version`)
- editar: `src/lib/arena-admin.functions.ts` (chamar notify em `updateArenaConnection`, adicionar campos webhook)
- editar: `src/routes/admin.arena.$id.tsx` (campos webhook + chamadas notify nas abas)
- atualizar: `/mnt/documents/antigravity-prompt.md` com o contrato do webhook + revalidação por `config_version`