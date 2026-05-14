import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import logoFull from "@/assets/logo-full.png";
import { ChevronRight, Flame, Loader2, MapPin, Radio, Search, User as UserIcon } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  component: Home,
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

const LIVE_THRESHOLD_MS = 10 * 60 * 1000;

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [topReplays, setTopReplays] = useState<GlobalReplay[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const topRes = await supabase.from("global_replays" as never)
        .select("*").order("created_at", { ascending: false }).limit(3);
      if (topRes.data) setTopReplays(topRes.data as unknown as GlobalReplay[]);
      setTopLoading(false);

      const [aRes, rRes] = await Promise.all([
        supabase.from("public_arenas" as never).select("*"),
        supabase.from("global_replays" as never)
          .select("*").order("created_at", { ascending: false }).limit(60),
      ]);
      if (aRes.data) setArenas(aRes.data as Arena[]);
      if (rRes.data) setReplays(rRes.data as unknown as GlobalReplay[]);
      setLoading(false);
    })();
  }, []);

  const liveIds = useMemo(() => {
    const set = new Set<string>();
    const now = Date.now();
    replays.forEach((r) => {
      if (now - new Date(r.created_at).getTime() < LIVE_THRESHOLD_MS) set.add(r.arena_id);
    });
    return set;
  }, [replays]);

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const filteredArenas = useMemo(() => {
    const q = norm(search);
    if (!q) return arenas;
    return arenas.filter((a) => {
      const hay = norm([a.name, a.city, a.state].filter(Boolean).join(" "));
      return hay.includes(q);
    });
  }, [arenas, search]);

  const enterArena = (id: string) => navigate({ to: "/arena/$id", params: { id } });

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
          <img src={logoFull} alt="LoopLance" className="h-14 w-auto" />
          <button
            onClick={() => navigate({ to: "/perfil" })}
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-primary"
            aria-label="Perfil"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {/* Hero - Top Replays Carousel */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-extrabold leading-tight">Últimos Replays</h1>
          </div>

          {topLoading ? (
            <Skeleton className="aspect-video w-full rounded-2xl" />
          ) : topReplays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Nenhum replay disponível ainda.
            </div>
          ) : (
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent>
                {topReplays.map((r) => (
                  <CarouselItem key={r.id} className="basis-full">
                    <button
                      onClick={() => navigate({ to: "/arena/$id", params: { id: r.arena_id } })}
                      className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black text-left"
                    >
                      {r.thumbnail_url ? (
                        <img src={r.thumbnail_url} alt={r.arena_name}
                          className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <video src={r.video_url} className="h-full w-full object-cover" muted preload="metadata" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
                        <div className="flex items-end justify-between gap-2">
                          <p className="truncate text-sm font-bold text-white">{r.arena_name}</p>
                          <p className="shrink-0 text-[10px] text-white/70">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )}
        </section>

        {/* Buscar arena */}
        <section className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arena ou cidade…" className="h-11 pl-9" />
          </div>
        </section>

        <section className="mt-4">
          <div className="space-y-2">
          <div className="mt-5 space-y-2">
            {loading ? (
              <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredArenas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Nenhuma arena encontrada.
              </div>
            ) : (
              filteredArenas.map((a) => (
                <button key={a.id} onClick={() => enterArena(a.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/60">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain bg-black/40 p-0.5" />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg font-bold text-black"
                      style={{ backgroundColor: a.primary_color }}>{a.name[0]}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{a.name}</p>
                      {liveIds.has(a.id) && (
                        <Badge className="border-0 bg-red-600 text-[9px] text-white">
                          <Radio className="mr-0.5 h-2.5 w-2.5 animate-pulse" />AO VIVO
                        </Badge>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[a.city, a.state].filter(Boolean).join(" · ") || "Localização não informada"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </section>

        {/* Feed recente */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider">Replays recentes</h2>
            <button className="text-xs font-medium text-primary" onClick={() => navigate({ to: "/replays" })}>
              Ver tudo
            </button>
          </div>
          {loading ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : replays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Sem replays no feed global.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {replays.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => navigate({ to: "/arena/$id", params: { id: r.arena_id } })}
                    className="block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/60"
                  >
                    <div className="relative aspect-video w-full bg-black">
                      {r.thumbnail_url
                        ? <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        : <video src={r.video_url} className="h-full w-full object-cover" muted preload="metadata" />}
                      <Badge className="absolute left-1.5 top-1.5 border-0 px-1.5 py-0 text-[9px] text-white shadow"
                        style={{ backgroundColor: r.arena_primary_color }}>
                        {r.arena_name}
                      </Badge>
                    </div>
                    <div className="p-2 text-[10px] text-muted-foreground">
                      {r.court_name ? `${r.court_name} · ` : ""}
                      {format(new Date(`${r.data_evento}T${r.hora_evento}`), "dd MMM HH:mm", { locale: ptBR })}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!user && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center text-sm">
            <p className="mb-2 text-foreground">Entre para favoritar arenas e gerar seus replays.</p>
            <button onClick={() => navigate({ to: "/login" })}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">
              Entrar
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
