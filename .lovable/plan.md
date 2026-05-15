## Objetivo
Implementar o item que faltou do escopo aprovado: **Simulador de Role (visual)** disponível apenas para usuários cuja role real é `superadmin`. Permite alternar a visão da UI entre **Super Admin / Dono de Arena / Usuário Normal** sem fazer logout e sem alterar permissões reais no banco (RLS continua exatamente igual).

## Como vai funcionar
- O superadmin real vê uma barra discreta no topo (sticky) com um `Select`: "Visualizar como: Super Admin | Dono de Arena | Usuário Normal".
- A escolha persiste em `localStorage` (`role-sim`) e é refletida em toda a UI dependente de role (sidebar, rotas, botões condicionais).
- Quando "Dono de Arena" é escolhido e o superadmin não tem `arena_id` próprio, abre um `Select` extra com a lista de arenas disponíveis para escolher qual arena simular.
- Quando ativo, mostra um badge laranja "Simulando: Dono · {arena}" para deixar claro que não é a visão real.
- Botão "Sair da simulação" volta ao modo Super Admin real.
- **Nenhuma query muda** — apenas as flags derivadas (`isSuperAdmin`, `adminArenaId`, `playerArenaIds`) são sobrescritas no contexto. Como o RLS no Supabase continua respondendo ao usuário real (superadmin), as queries continuam funcionando; só a UI fica restrita.

## Mudanças de arquivo

1. **Novo `src/contexts/role-simulator.tsx`**
   - `RoleSimulatorProvider` envolve o app no `__root.tsx`.
   - Estado: `mode: 'real' | 'admin_arena' | 'player'` + `simulatedArenaId: string | null`.
   - Persistência em `localStorage`.
   - Hook `useRoleSimulator()` expõe `mode`, `simulatedArenaId`, `setMode`, `setSimulatedArenaId`, `reset`.

2. **`src/hooks/use-auth.ts`** (ajuste pequeno)
   - Lê `useRoleSimulator()` e calcula um segundo conjunto de flags **derivadas** quando o usuário real é superadmin e o modo simulado é diferente de `real`:
     - modo `admin_arena` → `isSuperAdmin=false`, `isAdmin=true`, `adminArenaId=<simulated>`, `playerArenaIds=[]`.
     - modo `player` → `isSuperAdmin=false`, `isAdmin=false`, `adminArenaId=null`, `playerArenaIds=[<simulated>]` (ou `[]`).
   - Adiciona `realIsSuperAdmin` no retorno (usado pela barra do simulador para decidir se aparece).

3. **Novo `src/components/RoleSimulatorBar.tsx`**
   - Renderiza só se `realIsSuperAdmin && mode !== 'real'` ou se o usuário abrir o seletor.
   - Usa `Select` do shadcn para o modo, `Select` para a arena (carrega de `arenas` ativas).
   - Badge laranja quando ativo; botão "Sair da simulação".

4. **`src/routes/__root.tsx`**
   - Envolve a árvore com `<RoleSimulatorProvider>`.
   - Renderiza `<RoleSimulatorBar />` no topo (acima do `<Outlet />`).

## Fora do escopo
- Não mexer em RLS, queries ou em `admin.functions.ts`.
- Não tocar no fluxo do convite (já implementado).
- Não tocar na tela "Minhas Quadras" (já implementada).
- Não revisar a sidebar além do que já consome `useAuth` automaticamente.