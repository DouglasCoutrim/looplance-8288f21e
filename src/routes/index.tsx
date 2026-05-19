import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveReplayUrl } from "@/lib/replays";
import { useGlobalReplays } from "@/hooks/use-global-replays";

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

const LIVE_THRESHOLD_MS = 10 * 60 * 1000;

function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const { replays } = useGlobalReplays();
  const topReplays = useMemo(() => replays.slice(0, 5), [replays]);
  const topLoading = loading;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const sync = () => setCarouselIndex(carouselApi.selectedScrollSnap());
    sync();
    carouselApi.on("select", sync);
    carouselApi.on("reInit", sync);
    return () => {
      carouselApi.off("select", sync);
      carouselApi.off("reInit", sync);
    };
  }, [carouselApi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const aRes = await supabase.from("public_arenas" as never).select("*");
      if (!cancelled && aRes.data) setArenas(aRes.data as Arena[]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
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

  const stateOptions = useMemo(
    () => Array.from(new Set(arenas.map((a) => (a.state ?? "").trim()).filter(Boolean))).sort(),
    [arenas],
  );
  const cityOptions = useMemo(() => {
    const pool = filterState === "all"
      ? arenas
      : arenas.filter((a) => (a.state ?? "").trim() === filterState);
    return Array.from(new Set(pool.map((a) => (a.city ?? "").trim()).filter(Boolean))).sort();
  }, [arenas, filterState]);

  const filteredArenas = useMemo(() => {
    const q = norm(search);
    return arenas.filter((a) => {
      if (filterState !== "all" && (a.state ?? "").trim() !== filterState) return false;
      if (filterCity !== "all" && (a.city ?? "").trim() !== filterCity) return false;
      if (!q) return true;
      const hay = norm([a.name, a.city, a.state].filter(Boolean).join(" "));
      return hay.includes(q);
    });
  }, [arenas, search, filterState, filterCity]);

  const enterArena = (id: string) => navigate({ to: "/arena/$id", params: { id } });

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2">
          <img src={logoFull} alt="LoopLance" className="h-20 w-auto" />
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
        {/* Hero - Destaques Recentes */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-extrabold leading-tight">
              <span className="text-primary">🔥</span> Destaques Recentes
            </h1>
          </div>

          {topLoading ? (
            <Skeleton className="aspect-video w-full rounded-2xl" />
          ) : topReplays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Nenhum replay disponível ainda.
            </div>
          ) : (
            <div className="space-y-3">
              <Carousel
                opts={{ align: "center", loop: topReplays.length > 1 }}
                setApi={setCarouselApi}
                className="relative w-full"
              >
                <CarouselContent>
                  {topReplays.map((r: any) => (
                    <CarouselItem key={r.id} className="basis-full">
                      <button
                        onClick={() => navigate({ to: "/arena/$id", params: { id: r.arena_id } })}
                        className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black text-left"
                      >
                        {r.thumbnail_url ? (
                          <img src={resolveReplayUrl(r.thumbnail_url)} alt={r.arena_name}
                            className="h-full w-full object-cover transition group-hover:scale-105" />
                        ) : (
                          <video src={resolveReplayUrl(r.video_url)} className="h-full w-full object-cover" muted preload="metadata" />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
                          <div className="flex items-end justify-between gap-2">
                            <p className="truncate text-sm font-bold text-white">{r.arena_name}</p>
                            <p
                              className="shrink-0 text-[10px] text-white/70"
                              title={new Date(r.created_at).toLocaleString("pt-BR", {
                                timeZone: "America/Sao_Paulo",
                                day: "2-digit", month: "2-digit", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            >
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </button>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {topReplays.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2 h-9 w-9 border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white" />
                    <CarouselNext className="right-2 h-9 w-9 border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white" />
                  </>
                )}
              </Carousel>

              {topReplays.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                  {topReplays.map((r: any, i: number) => (
                    <button
                      key={r.id}
                      onClick={() => carouselApi?.scrollTo(i)}
                      aria-label={`Ir para slide ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === carouselIndex ? "w-6 bg-primary" : "w-1.5 bg-muted hover:bg-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Filtros + busca */}
        <section className="mt-6 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterState} onValueChange={(v) => { setFilterState(v); setFilterCity("all"); }}>
              <SelectTrigger className="h-11"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {stateOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCity} onValueChange={setFilterCity} disabled={cityOptions.length === 0}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arena ou cidade…" className="h-11 pl-9" />
          </div>
        </section>

        <section className="mt-4">
          <div className="space-y-2">
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
                        ? <img src={resolveReplayUrl(r.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                        : <video src={resolveReplayUrl(r.video_url)} className="h-full w-full object-cover" muted preload="metadata" />}
                      <Badge className="absolute left-1.5 top-1.5 border-0 px-1.5 py-0 text-[9px] text-white shadow"
                        style={{ backgroundColor: r.arena_primary_color }}>
                        {r.arena_name}
                      </Badge>
                    </div>
                    <div className="p-2 text-[10px] text-muted-foreground">
                      {r.court_name ? `${r.court_name} · ` : ""}
                      {format(new Date(r.created_at), "dd MMM HH:mm", { locale: ptBR })}
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
