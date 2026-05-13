import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoMark from "@/assets/logo-mark.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { MapPin, PlayCircle, Loader2, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  component: GlobalPortal,
  head: () => ({
    meta: [
      { title: "LoopLance — Portal Global de Replays" },
      { name: "description", content: "Reveja os melhores lances de todas as arenas LoopLance em um só lugar." },
      { property: "og:title", content: "LoopLance — Portal Global" },
      { property: "og:description", content: "Replays esportivos de todas as arenas conectadas." },
    ],
  }),
});

interface Arena { id: string; name: string; slug: string; primary_color: string; logo_url: string | null; }
interface GlobalReplay {
  id: string;
  arena_id: string;
  arena_name: string;
  arena_slug: string;
  arena_primary_color: string;
  arena_logo_url: string | null;
  court_id: string | null;
  court_name: string | null;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  data_evento: string;
  hora_evento: string;
  created_at: string;
}
interface Sponsor { id: string; name: string; logo_url: string; link_url: string | null; }

const BRAND = "#FF6600";

function GlobalPortal() {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterArena, setFilterArena] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterCourt, setFilterCourt] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, rRes, sRes] = await Promise.all([
        supabase.from("public_arenas" as never).select("*"),
        supabase.from("global_replays" as never).select("*").order("created_at", { ascending: false }).limit(120),
        // Global sponsors = sponsors with arena_id NULL would be ideal; for now show all top sponsors limited.
        supabase.from("arena_sponsors").select("id,name,logo_url,link_url").order("display_order").limit(8),
      ]);
      if (aRes.data) setArenas(aRes.data as Arena[]);
      if (rRes.data) setReplays(rRes.data as unknown as GlobalReplay[]);
      if (sRes.data) setSponsors(sRes.data as Sponsor[]);
      setLoading(false);
    })();
  }, []);

  const courts = useMemo(() => {
    const map = new Map<string, string>();
    replays.forEach(r => {
      if (r.court_id && r.court_name && (filterArena === "all" || r.arena_id === filterArena)) {
        map.set(r.court_id, r.court_name);
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [replays, filterArena]);

  const filtered = useMemo(() => {
    return replays.filter(r => {
      if (filterArena !== "all" && r.arena_id !== filterArena) return false;
      if (filterDate && r.data_evento !== filterDate) return false;
      if (filterCourt !== "all" && r.court_id !== filterCourt) return false;
      return true;
    });
  }, [replays, filterArena, filterDate, filterCourt]);

  const highlights = replays.slice(0, 3);

  const handleArenaSelect = (slug: string) => {
    if (slug === "__none") return;
    navigate({ to: "/play/$slug", params: { slug } });
  };

  const goToArena = (slug: string) => navigate({ to: "/play/$slug", params: { slug } });

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: BRAND }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoMark} alt="LoopLance" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">LoopLance</span>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={handleArenaSelect}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue placeholder="Ir para Arena…" />
              </SelectTrigger>
              <SelectContent>
                {arenas.map(a => (
                  <SelectItem key={a.id} value={a.slug}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/login" })}>Entrar</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-black text-white">
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(circle at 30% 20%, ${BRAND}66, transparent 60%), radial-gradient(circle at 80% 80%, ${BRAND}33, transparent 50%)` }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center">
          <h1 className="mb-3 text-3xl font-extrabold md:text-5xl">
            Repita a <span style={{ color: BRAND }}>emoção</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-white/70 md:text-base">
            Os melhores lances de todas as arenas LoopLance, em tempo real.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Highlights Carousel */}
        {highlights.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Destaques globais</h2>
              <span className="text-xs text-muted-foreground">Top 3 mais recentes</span>
            </div>
            <Carousel
              opts={{ loop: true }}
              plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
              className="w-full"
            >
              <CarouselContent>
                {highlights.map(r => (
                  <CarouselItem key={r.id} className="md:basis-2/3 lg:basis-1/2">
                    <ReplayCard replay={r} onArenaClick={goToArena} large />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </section>
        )}

        {/* Filters */}
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Arena</label>
              <Select value={filterArena} onValueChange={setFilterArena}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as arenas</SelectItem>
                  {arenas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Data</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Quadra</label>
              <Select value={filterCourt} onValueChange={setFilterCourt}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as quadras</SelectItem>
                  {courts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filterArena !== "all" || filterDate || filterCourt !== "all") && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setFilterArena("all"); setFilterDate(""); setFilterCourt("all"); }}>
                Limpar filtros
              </Button>
            </div>
          )}
        </section>

        {/* Feed */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Feed global</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "vídeo" : "vídeos"}</span>
          </div>

          {loading ? (
            <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              <MapPin className="mx-auto mb-3 h-10 w-10 opacity-30" />
              Nenhum replay encontrado com esses filtros.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(r => <ReplayCard key={r.id} replay={r} onArenaClick={goToArena} />)}
            </div>
          )}
        </section>
      </main>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Patrocinadores Globais
            </h3>
            <div className="grid grid-cols-3 items-center gap-6 sm:grid-cols-4 md:grid-cols-6">
              {sponsors.map(s => (
                <a key={s.id} href={s.link_url || "#"} target="_blank" rel="noopener noreferrer"
                  className="flex h-16 items-center justify-center rounded-lg bg-white p-3 grayscale transition hover:grayscale-0">
                  <img src={s.logo_url} alt={s.name} className="max-h-full max-w-full object-contain" />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LoopLance — Repita a emoção.
      </footer>
    </div>
  );
}

function ReplayCard({ replay, onArenaClick, large }: { replay: GlobalReplay; onArenaClick: (slug: string) => void; large?: boolean }) {
  const navigate = useNavigate();
  const open = () => navigate({ to: "/play/$slug", params: { slug: replay.arena_slug } });
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-lg">
      <button type="button" onClick={open} className="relative block w-full aspect-video bg-black">
        {replay.thumbnail_url ? (
          <img src={replay.thumbnail_url} alt={replay.title || replay.arena_name} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <video src={replay.video_url} className="h-full w-full object-cover" muted preload="metadata" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/40">
          <PlayCircle className={`text-white opacity-90 drop-shadow ${large ? "h-16 w-16" : "h-12 w-12"}`} />
        </div>
        <Badge
          className="absolute left-3 top-3 border-0 text-white shadow"
          style={{ backgroundColor: replay.arena_primary_color || BRAND }}
        >
          {replay.arena_name}
        </Badge>
      </button>
      <div className="flex items-center justify-between gap-3 p-4">
        <button type="button" onClick={(e) => { e.stopPropagation(); onArenaClick(replay.arena_slug); }} className="flex min-w-0 items-center gap-3 text-left">
          {replay.arena_logo_url ? (
            <img src={replay.arena_logo_url} alt="" className="h-9 w-9 rounded-md bg-white object-contain p-0.5" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: replay.arena_primary_color || BRAND }}>
              {replay.arena_name?.[0] || "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{replay.arena_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {replay.court_name ? `${replay.court_name} • ` : ""}
              {format(new Date(`${replay.data_evento}T${replay.hora_evento}`), "dd MMM, HH:mm", { locale: ptBR })}
            </p>
          </div>
        </button>
      </div>
    </article>
  );
}
