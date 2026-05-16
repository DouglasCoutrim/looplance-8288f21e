# Conectar o backend agent à arena

## Situação atual

| Item | Status |
|---|---|
| Endpoint `/api/public/agent/config` | ✅ Funciona (exige Bearer) |
| `config_version` + triggers de bump | ✅ Funciona |
| Webhook push (`agent_webhook_url` / `_secret` na arena) | ✅ Schema pronto, sem valor cadastrado |
| Geração e gestão de **ARENA_INGEST_TOKEN** | ❌ Tabela existe (`arena_ingest_tokens`) mas **não há UI** nem registros |
| Prompt do Antigravity | ✅ Completo em `/mnt/documents/antigravity-prompt.md` |

A peça que falta no **frontend** para o backend funcionar é a UI de tokens de ingest. Sem isso, o agente não consegue chamar `/api/public/agent/config`.

## O que vou fazer

### 1. UI de Tokens de Ingest (aba "Conexão" em `admin.arena.$id.tsx`)
- Listar tokens existentes (nome, prefixo, data, último uso, status revogado)
- Botão "Gerar novo token":
  - Server function `createArenaIngestToken({ arena_id, name })`
  - Gera 32 bytes random → token plano `lov_ing_<base64url>`
  - Salva `token_hash` (SHA-256) + `token_prefix` (8 chars) no DB
  - Retorna o token **uma única vez** num modal (com botão copiar)
- Botão "Revogar" por linha → seta `revoked_at = now()`

### 2. Validação do token no endpoint `/api/public/agent/config`
- Já existe; vou confirmar que ele faz lookup por `token_hash` e rejeita tokens revogados. Ajustar se necessário.

### 3. Revisar o prompt do Antigravity (`/mnt/documents/antigravity-prompt.md`)
- Já tem webhook + polling + mapeamento de IDs corretos
- Vou adicionar instrução explícita: **como obter o `ARENA_INGEST_TOKEN`** (pelo painel) e exemplo de `.env` final
- Pequeno reforço sobre idempotência e logs

### 4. Documentar o fluxo de bring-up
Adicionar no prompt um checklist "primeira vez":
1. Admin gera token no painel → copia
2. Admin preenche `agent_webhook_url` + `agent_webhook_secret` na aba Conexão
3. Operador instala o agent no Pi com `ARENA_INGEST_TOKEN` no `.env`
4. Agent valida com `GET /healthz` + um botão de teste

## Arquivos a alterar

- `src/lib/arena-admin.functions.ts` — `createArenaIngestToken`, `listArenaIngestTokens`, `revokeArenaIngestToken`
- `src/routes/admin.arena.$id.tsx` — nova seção "Tokens do Agente" na aba Conexão
- `src/routes/api/public/agent.config.ts` — confirmar/ajustar validação por hash
- `/mnt/documents/antigravity-prompt.md` — seção "Bring-up" + exemplo de `.env`

## Detalhes técnicos

**Hash do token** (server-side, ao gerar):
```ts
const raw = crypto.randomBytes(32).toString('base64url');
const token = `lov_ing_${raw}`;
const token_hash = crypto.createHash('sha256').update(token).digest('hex');
const token_prefix = token.slice(0, 12);
```

**Validação no endpoint**:
```ts
const auth = request.headers.get('authorization');
const token = auth?.replace(/^Bearer /, '');
const hash = sha256(token);
const row = await supabaseAdmin
  .from('arena_ingest_tokens')
  .select('arena_id, revoked_at')
  .eq('token_hash', hash)
  .maybeSingle();
if (!row || row.revoked_at) return 401;
await supabaseAdmin.from('arena_ingest_tokens')
  .update({ last_used_at: new Date().toISOString() })
  .eq('token_hash', hash);
```

## Critério de aceite

1. Superadmin/admin abre **Arena → Conexão**, gera token, copia uma vez
2. `curl -H "Authorization: Bearer <token>" .../api/public/agent/config` retorna a config completa com `config_version`
3. Cadastrar webhook URL → criar uma quadra → o agente (quando rodando) recebe `POST /agent/reload` em <2s
4. Revogar token → próxima chamada retorna 401
5. Prompt do Antigravity contém o passo-a-passo completo de bring-up
