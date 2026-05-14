# Plano de ajustes — Home, Player e Identidade

## Contexto verificado
- Bucket `replays` vive no projeto Supabase **externo** `htirxluqufyexmpuhhbt`. Os 2 registros atuais em `global_replays` já gravam `video_url` como URL absoluta (`https://htirxluqufyexmpuhhbt.../replays/replay_quadra_1_*.mp4`). Não precisamos alterar dados; apenas blindar o front para também aceitar **nomes de arquivo soltos** (caso o script Python grave só o filename no futuro).
- O carrossel já lê de `global_replays` ordenando por `created_at desc limit 3` (mantido).
- Os Selects de UF/Cidade foram removidos na iteração anterior — só restou input de texto. Vamos reintroduzi-los e populá-los a partir de `arenas`.
- Player em `src/routes/arena.$id.tsx` já usa `useRef`, mas troca `src` via prop a cada `selected` → causa "flick". Vamos atribuir `src` imperativo + `load()` no efeito.
- `--primary` em `styles.css` já é laranja (`oklch(0.70 0.20 45)`). Auditoria leve para garantir que botões/estados ativos usam `bg-primary` / `text-primary`, sem cores hard-coded.

## Mudanças

### 1. `src/lib/replays.ts` (novo, util pequeno)
- Exportar constante `REPLAYS_BASE_URL = "https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/"`.
- Exportar helper `resolveReplayUrl(value)`:
  - se começar com `http`, retorna como está;
  - senão concatena `REPLAYS_BASE_URL + value`.

### 2. `src/routes/index.tsx`
- Importar `resolveReplayUrl` e usar em todos os `<img src>` e `<video src>` do carrossel e do feed.
- Manter Skeleton já existente; nada de novo aqui no carrossel.
- **Reintroduzir filtros UF/Cidade** acima do input de busca:
  - Dois `Select` (shadcn) preenchidos a partir de `arenas` já carregadas (`useMemo` distinto por `state`/`city`).
  - Cidade depende do estado selecionado; opção "Todos".
  - `filteredArenas` passa a combinar `state`, `city` e termo de busca.
- Aumentar logo no header: `h-14` → `h-20`.

### 3. `src/routes/arena.$id.tsx` (player sem piscar)
- Atribuir `src` via efeito imperativo:
  ```ts
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !selected) return;
    const url = resolveReplayUrl(selected.video_url);
    if (v.src !== url) { v.src = url; v.load(); }
  }, [selected]);
  ```
- Remover `src={selected.video_url}` do JSX do `<video>`.
- Aplicar `resolveReplayUrl` também na thumbnail e no editor de corte.
- Garantir que **nenhuma checagem de role** bloqueie a visualização ou o editor (apenas exigir `user` autenticado para o botão "Cortar e enviar").

### 4. Identidade visual (auditoria curta)
- `src/components/BottomNav.tsx`, botões "Ver tudo", "Entrar", badges → confirmar `bg-primary / text-primary` (sem `bg-orange-500` literal).
- Header da Home: logo maior (`h-20 w-auto`).

### 5. Segurança / acesso
- Sem nova migration. Apenas remover qualquer `if (!isAdmin) return <Navigate.../>` remanescente nas rotas de player/replay (varredura rápida em `arena.$id.tsx` e `meus-replays.tsx`). Rota `/painel` e `/admin` permanecem restritas.

## Não-objetivos
- Não criar bucket local `replays`.
- Não migrar vídeos.
- Não alterar `replay_jobs` nem o pipeline Python.

```text
Home
├── Header (logo h-20 + perfil)
├── Carrossel "Últimos Replays" (3 slides, URL via resolveReplayUrl)
├── Filtros: [UF ▼] [Cidade ▼] [🔍 buscar…]
├── Lista de arenas (filtrada)
└── Feed recente (grid 2 col)
```
