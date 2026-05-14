import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import logoMark from "@/assets/logo-mark.png";
import { MapPin, PlayCircle, Loader2, Search, Star, Radio, ChevronRight, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: GlobalPortal,
  head: () => ({
    meta: [
      { title: "LoopLance — Encontre sua arena" },
      { name: "description", content: "Selecione sua arena, reveja lances e crie replays profissionais em segundos." },
      { property: "og:title", content: "LoopLance — Encontre sua arena" },
      { property: "og:description", content: "Plataforma única de replays esportivos." },
    ],
  }),
});

interface Arena {
  id: string; name: string; slug: string;
  primary_color: string; logo_url: string | null;
  city: string | null; state: string | null;
}
interface GlobalReplay {
  id: string; arena_id: string; arena_name: string; arena_slug: string;
  arena_primary_color: string; arena_logo_url: string | null;
  court_id: string | null; court_name: string | null;
  title: string | null; video_url: string; thumbnail_url: string | null;
  data_evento: string; hora_evento: string; created_at: string;
}

const BRAND = "#FF6600";
const LIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

function GlobalPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Arena selector filters
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterCity, setFilterCity] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, rRes] = await Promise.all([
        supabase.from("public_arenas" as never).select("*"),
        supabase.from("global_replays" as never)
          .select("*").order("created_at", { ascending: false }).limit(120),
      ]);
      if (aRes.data) setArenas(aRes.data as Arena[]);
      if (rRes.data) setReplays(rRes.data as unknown as GlobalReplay[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) { setFavorites(new Set()); return; }
    (async () => {
      const { data } = await supabase
        .from("favorite_arenas" as never)
        .select("arena_id")
        .eq("user_id", user.id);
      setFavorites(new Set(((data ?? []) as { arena_id: string }[]).map((r) => r.arena_id)));
    })();
  }, [user]);

  const liveArenaIds = useMemo(() => {
    const set = new Set<string>();
    const now = Date.now();
    replays.forEach((r) => {
      if (now - new Date(r.created_at).getTime() < LIVE_THRESHOLD_MS) set.add(r.arena_id);
    });
    return set;
  }, [replays]);

  const states = useMemo(() => {
    const s = new Set<string>();
    arenas.forEach((a) => { if (a.state) s.add(a.state); });
    return Array.from(s).sort();
  }, [arenas]);

  const cities = useMemo(() => {
    const c = new Set<string>();
    arenas
      .filter((a) => filterState === "all" || a.state === filterState)
      .forEach((a) => { if (a.city) c.add(a.city); });
    return Array.from(c).sort();
  }, [arenas, filterState]);

  const filteredArenas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return arenas.filter((a) => {
      if (filterState !== "all" && a.state !== filterState) return false;
      if (filterCity !== "all" && a.city !== filterCity) return false;
      if (q && !a.name.toLowerCase().includes(q) && !(a.city ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [arenas, search, filterState, filterCity]);

  const favoriteArenas = useMemo(
    () => arenas.filter((a) => favorites.has(a.id)),
    [arenas, favorites],
  );

  async function toggleFavorite(arenaId: string) {
    if (!user) {
      toast.info("Faça login para favoritar arenas");
      navigate({ to: "/login" });
      return;
    }
    if (favorites.has(arenaId)) {
      await supabase.from("favorite_arenas" as never).delete().eq("user_id", user.id).eq("arena_id", arenaId);
      const next = new Set(favorites); next.delete(arenaId); setFavorites(next);
    } else {
      await supabase.from("favorite_arenas" as never).insert({ user_id: user.id, arena_id: arenaId } as never);
      setFavorites(new Set([...favorites, arenaId]));
    }
  }

  const enterArena = (a: Arena) => navigate({ to: "/arena/$id", params: { id: a.id } });

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: BRAND }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logoMark} alt="LoopLance" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">LoopLance</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/meus-replays" })}>
                <UserIcon className="h-4 w-4" /> Meus replays
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/login" })}>Entrar</Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-black text-white">
        <div className="absolute inset-0 opacity-50"
          style={{ background: `radial-gradient(circle at 30% 20%, ${BRAND}66, transparent 60%), radial-gradient(circle at 80% 80%, ${BRAND}33, transparent 50%)` }} />
        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center">
          <h1 className="mb-2 text-3xl font-extrabold md:text-5xl">
            Encontre sua <span style={{ color: BRAND }}>arena</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-white/70 md:text-base">
            Acesse câmeras ao vivo, reveja lances e gere seus replays em segundos.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Search bar */}
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arena ou cidade…" className="pl-9 h-11" />
          </div>
          <Select value={filterState} onValueChange={(v) => { setFilterState(v); setFilterCity("all"); }}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas ({filteredArenas.length})</TabsTrigger>
            <TabsTrigger value="favorites">
              <Star className="mr-1 h-3.5 w-3.5" /> Favoritas ({favoriteArenas.length})
            </TabsTrigger>
            <TabsTrigger value="feed">Feed global</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ArenaGrid arenas={filteredArenas} liveSet={liveArenaIds} favorites={favorites}
              onEnter={enterArena} onToggleFav={toggleFavorite} loading={loading} />
          </TabsContent>

          <TabsContent value="favorites">
            {!user ? (
              <EmptyState text="Entre para favoritar suas arenas e ter acesso rápido." cta={() => navigate({ to: "/login" })} />
            ) : favoriteArenas.length === 0 ? (
              <EmptyState text="Você ainda não favoritou nenhuma arena. Toque na estrela em qualquer arena para começar." />
            ) : (
              <ArenaGrid arenas={favoriteArenas} liveSet={liveArenaIds} favorites={favorites}
                onEnter={enterArena} onToggleFav={toggleFavorite} loading={false} />
            )}
          </TabsContent>

          <TabsContent value="feed">
            <GlobalFeed replays={replays} loading={loading}
              onArenaClick={(slug) => {
                const a = arenas.find((x) => x.slug === slug);
                if (a) enterArena(a);
              }} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LoopLance — Repita a emoção.
      </footer>
    </div>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
      <Star className="mx-auto mb-3 h-10 w-10 opacity-30" />
      <p className="mb-3">{text}</p>
      {cta && <Button size="sm" onClick={cta}>Entrar</Button>}
    </div>
  );
}

function ArenaGrid({
  arenas, liveSet, favorites, onEnter, onToggleFav, loading,
}: {
  arenas: Arena[]; liveSet: Set<string>; favorites: Set<string>;
  onEnter: (a: Arena) => void; onToggleFav: (id: string) => void; loading: boolean;
}) {
  if (loading) {
    return <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} /></div>;
  }
  if (arenas.length === 0) {
    return <EmptyState text="Nenhuma arena encontrada com esses filtros." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {arenas.map((a) => {
        const live = liveSet.has(a.id);
        const fav = favorites.has(a.id);
        return (
          <article key={a.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-lg">
            <button type="button" onClick={() => onEnter(a)} className="block w-full text-left">
              <div className="relative h-32 w-full" style={{ background: `linear-gradient(135deg, ${a.primary_color}, ${a.primary_color}aa 70%, #000)` }}>
                {a.logo_url && (
                  <img src={a.logo_url} alt="" className="absolute inset-0 m-auto h-16 w-16 object-contain opacity-90" />
                )}
                <div className="absolute right-2 top-2 flex gap-1">
                  {live && (
                    <Badge className="border-0 bg-red-600 text-white">
                      <Radio className="mr-1 h-3 w-3 animate-pulse" /> AO VIVO
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-base font-bold">{a.name}</h3>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[a.city, a.state].filter(Boolean).join(" · ") || "Localização não informada"}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFav(a.id); }}
              aria-label={fav ? "Remover dos favoritos" : "Favoritar arena"}
              className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <Star className={`h-4 w-4 ${fav ? "fill-yellow-400 text-yellow-400" : ""}`} />
            </button>
          </article>
        );
      })}
    </div>
  );
}

function GlobalFeed({
  replays, loading, onArenaClick,
}: { replays: GlobalReplay[]; loading: boolean; onArenaClick: (slug: string) => void }) {
  if (loading) return <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} /></div>;
  if (replays.length === 0) return <EmptyState text="Nenhum replay no feed global." />;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {replays.map((r) => (
        <article key={r.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-lg">
          <button type="button" onClick={() => onArenaClick(r.arena_slug)} className="relative block w-full aspect-video bg-black">
            {r.thumbnail_url
              ? <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              : <video src={r.video_url} className="h-full w-full object-cover" muted preload="metadata" />}
            <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/40">
              <PlayCircle className="h-12 w-12 text-white opacity-90 drop-shadow" />
            </div>
            <Badge className="absolute left-3 top-3 border-0 text-white shadow"
              style={{ backgroundColor: r.arena_primary_color || BRAND }}>
              {r.arena_name}
            </Badge>
          </button>
          <div className="p-4 text-xs text-muted-foreground">
            {r.court_name ? `${r.court_name} • ` : ""}
            {format(new Date(`${r.data_evento}T${r.hora_evento}`), "dd MMM, HH:mm", { locale: ptBR })}
          </div>
        </article>
      ))}
    </div>
  );
}
