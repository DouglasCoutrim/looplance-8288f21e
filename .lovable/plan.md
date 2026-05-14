# Carrossel real de Destaques na Home

## Mudanças (apenas `src/routes/index.tsx`)

1. Trocar título: `Últimos Replays` → **"🔥 Destaques Recentes"** (mantendo o ícone `Flame` em laranja).
2. Reescrever o bloco do carrossel para ser um slideshow real:
   - Manter `Carousel` do shadcn (já usa Embla, swipe nativo).
   - `opts={{ loop: true, align: "center" }}`.
   - Renderizar `topReplays.map(...)` (1 a 3 slides — não quebra com menos).
   - Cada `CarouselItem` ocupa `basis-full` em mobile, 16:9, com gradiente + `arena_name` + tempo relativo.
   - Adicionar **setas** `CarouselPrevious` / `CarouselNext` posicionadas sobre o vídeo (canto direito interno, ocultas se houver < 2 slides).
   - Adicionar **pontinhos de paginação** abaixo, controlados via `setApi` + `api.on("select", ...)`. O ponto ativo usa `bg-primary` (laranja), inativos `bg-muted`.
3. URL via `resolveReplayUrl` (já existe) → garante o prefixo `https://htirxluqufyexmpuhhbt.supabase.co/storage/v1/object/public/replays/` quando o banco gravar só o filename.
4. Mantém Skeleton enquanto carrega e empty state quando 0 vídeos.

## Não-objetivos
- Sem autoplay (não pedido).
- Sem alterar o feed inferior nem filtros UF/Cidade.
- Sem migrações.
