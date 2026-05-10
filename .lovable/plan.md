## Objetivo
Adicionar exclusão de arenas, cadastro automático de novos usuários como `player` com promoção manual, e automação completa do hardware ARC-968 (12 botões K1–K12) com vinculação exclusiva às câmeras.

## 1. Exclusão de Arenas
- Na lista do SuperAdmin (`/admin`), adicionar botão "Excluir" com `AlertDialog` de confirmação.
- DELETE em cascata via migration: ajustar FKs lógicas (arena_buttons, cameras, courts, videos, zero_delay_boards, user_roles) para `ON DELETE CASCADE` recriando as constraints.
- Apenas SuperAdmin vê o botão (RLS `arenas_super_all` já permite).

## 2. Cadastro automático como Player + promoção
- Atualizar a função `handle_new_user()` para também inserir em `user_roles` com `role = 'player'` e `arena_id = NULL`.
- Garantir trigger `on_auth_user_created` em `auth.users` (criar se não existir).
- Nova aba **"Usuários Globais"** na rota `/admin` (apenas SuperAdmin):
  - Lista todos os profiles + roles atuais.
  - Ações: promover a `superadmin`, definir como `admin_arena` (com seleção de arena), ou rebaixar a `player`.
  - Implementado via `INSERT`/`DELETE` em `user_roles` (RLS já cobre).

## 3. Hardware ARC-968 — schema
Migration adaptada ao schema atual (mantemos nomes em inglês já existentes: `zero_delay_boards`, `arena_buttons`, `cameras`):

- `zero_delay_boards`: adicionar coluna `model TEXT NOT NULL DEFAULT 'ARC-968'`.
- `arena_buttons`: adicionar colunas
  - `board_id UUID` (referência a `zero_delay_boards.id`)
  - `button_number INT`
  - `hardware_pin TEXT` (K1, K2, …)
  - `camera_id UUID` (espelho da associação, para o script Python)
  - índice único `(board_id, button_number)`.
- Função `generate_arc968_buttons()` + trigger `AFTER INSERT ON zero_delay_boards` que insere os 12 botões com o mapeamento solicitado:
  K1, K2, K3, K4, L2, R2, L1, R1, SE, ST, K11, K12.
- Trigger `AFTER INSERT/UPDATE/DELETE ON cameras` que sincroniza `arena_buttons.camera_id` com `cameras.button_id` (mantém os dois lados consistentes; o script Python lê de `arena_buttons`).

## 4. UI — `/admin/arena/[id]`

### Aba Hardware
- Ao cadastrar uma placa, exibir grid 4×3 com os 12 botões da placa.
- Cada botão mostra: nome amigável (`Botão 01 (K1)`), pino, e status:
  - Verde "Livre" se `camera_id IS NULL`
  - Laranja "Em uso → {nome da câmera}" caso contrário.

### Aba Câmeras
- Dropdown "Vincular Botão" no formulário de criação/edição:
  - Lista apenas botões da arena com `camera_id IS NULL` **ou** o botão atualmente vinculado à câmera em edição.
  - Mostra rótulo amigável `Botão NN (PINO)`.
- Ao salvar:
  - `UPDATE cameras SET button_id = ...` (trigger sincroniza `arena_buttons.camera_id`).
  - Ao desvincular/excluir câmera, o botão volta a ficar disponível automaticamente.

## 5. Observação sobre a SQL enviada
Sua SQL referencia tabelas `dispositivos` e `botoes`, que não existem neste projeto — usamos `zero_delay_boards` e `arena_buttons`. Vou aplicar a mesma lógica (trigger + 12 botões com o mapeamento K1…K12) sobre as tabelas atuais para não quebrar o restante do sistema. Se preferir renomear as tabelas para `dispositivos`/`botoes`, me avise antes.

## Arquivos a alterar
- Migrations Supabase (delete cascade, handle_new_user, schema hardware, triggers).
- `src/routes/admin.tsx` — botão excluir arena + aba Usuários Globais.
- `src/routes/admin.arena.$id.tsx` — grid de 12 botões na aba Hardware; dropdown filtrado na aba Câmeras com sincronização.
- `src/integrations/supabase/types.ts` — regenerado após migration.