## Diagnóstico

Investiguei os dois bugs reportados.

### 1. Player piscando ao clicar em vídeo (BUG REAL — causa raiz encontrada)

**Não é problema de `useState`/`useRef` no player.** O componente `PlayerWithControls` já usa `useRef` corretamente, e o `<video key={selected.id}>` força remount apenas quando o vídeo muda.

A causa real é um **conflito de rotas do TanStack Router (file-based flat routing)**:

- Existe `src/routes/arena.tsx` (painel admin `/arena`)
- Existe `src/routes/arena.$id.tsx` (dashboard público `/arena/:id`)

Pela convenção do TanStack, `arena.tsx` é tratado como **layout pai** de `arena.$id.tsx`. Mas o `ArenaPanel` em `arena.tsx`:
1. Não renderiza `<Outlet />`
2. Faz `if (!adminArenaId) return <Navigate to="/" />`

Resultado: qualquer usuário comum (sem `admin_arena`) que acessa `/arena/<id>` cai dentro do layout pai, é imediatamente redirecionado para `/`, e o componente filho `ArenaDashboard` nunca chega a montar. Visualmente isso é o "flick" — a página /arena/$id pisca e volta pra home.

### 2. Filtros Estado / Cidade vazios (NÃO é bug de código)

O componente já lê `arenas` direto e calcula estados/cidades distintos via `useMemo`. Confirmei na base de dados:

```
count | state_filled | city_filled
   1  |       0      |      0
```

A única arena cadastrada (`CTC Cristalina`) tem as colunas `city` e `state` **NULL**. Os selects estão corretamente vazios porque não há dado. A normalização `{ label, value }` é desnecessária aqui — `Select` do shadcn aceita strings primitivas e o código já mapeia certo.

A correção real é **preencher esses dados** — seja via painel admin (`/arena` → aba Arena) ou direto no banco.

---

## Plano

### A. Fix do flicker — renomear o painel admin

Renomear `src/routes/arena.tsx` → `src/routes/painel.tsx` (rota `/painel`). Isso elimina o conflito de layout. `arena.$id.tsx` passa a ser uma rota raiz de primeiro nível sem pai, e `ArenaDashboard` monta normalmente.

Atualizar referências:
- `src/components/AppSidebar.tsx` — link "Painel da arena" → `/painel`
- Qualquer redirect ou link interno que aponte para `/arena` (verificar `admin.tsx`, `acesso-negado.tsx`, etc.)

### B. Adicionar campos City / State no painel admin

Em `src/routes/painel.tsx` (renomeado), adicionar inputs para `city` e `state` na aba "Arena", incluí-los no `update` do `saveArenaName` (renomear para `saveArenaInfo`). Assim o admin consegue popular os filtros que o usuário esperava ver.

### C. Confirmar editor de corte (já está OK)

Verifiquei o `ReplayEditor` em `arena.$id.tsx`: já envia coordenadas normalizadas `coords_json: { x, y, w, h }` (0..1), `start_time`, `end_time`, `aspect_ratio`, `arena_id`, `status: 'pending'` para `replay_jobs`. **Nenhuma alteração necessária** — a estrutura JSON está pronta para o script Python externo.

### D. Manter

- Bottom Tab Bar
- Home híbrida (busca + feed global)
- Identidade laranja LoopLance (`#FF6600`)
- `useRef` no `<video>` do player

---

## Detalhes técnicos

| Arquivo | Ação |
|---|---|
| `src/routes/arena.tsx` | Renomear para `src/routes/painel.tsx` + trocar `createFileRoute("/arena")` por `createFileRoute("/painel")` |
| `src/routes/painel.tsx` | Adicionar campos `city` / `state` no form e no `update` |
| `src/components/AppSidebar.tsx` | Atualizar link `/arena` → `/painel` |
| `src/routes/admin.tsx`, `acesso-negado.tsx` | Verificar/atualizar referências a `/arena` |
| `src/routes/arena.$id.tsx` | Sem mudanças |
| `src/routes/index.tsx` | Sem mudanças (filtros já funcionam, só faltam dados) |

Resultado esperado: usuário comum clica em qualquer vídeo no feed → vai pra `/arena/<id>` → dashboard renderiza com player funcional. Admin acessa `/painel` para cadastrar city/state, e os filtros do home passam a popular automaticamente.