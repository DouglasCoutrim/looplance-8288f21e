import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getArenaClient } from "@/lib/arena-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Download, Loader2, MapPin, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LiveStream } from "@/components/LiveStream";

export const Route = createFileRoute("/play/$slug")({
  component: PlayArenaPage,
  head: ({ params }) => ({
    meta: [
      { title: `Replays — ${params.slug}` },
      { name: "description", content: "Reveja os melhores lances da arena. Filtre por quadra, data e horário." },
    ],
  }),
});

interface PublicArena {
  id: string; slug: string; name: string;
  logo_url: string | null; primary_color: string;
  supabase_url: string | null; supabase_anon_key: string | null;
}
interface Sponsor { id: string; name: string; logo_url: string; link_url: string | null }
interface Quadra { id: string; nome: string }
interface Replay {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  data_evento: string; // YYYY-MM-DD
  hora_evento: string; // HH:mm[:ss]
  quadra_id: string | null;
}

function PlayArenaPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [arena, setArena] = useState<PublicArena | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  // filters
  const [court, setCourt] = useState<string>("all");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("all");

  // Load arena (central) + sponsors
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("public_arenas" as never)
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setArena(a as PublicArena | null);
      if (a) {
        const { data: s } = await supabase
          .from("arena_sponsors")
          .select("id,name,logo_url,link_url")
          .eq("arena_id", (a as PublicArena).id)
          .order("display_order");
        setSponsors((s ?? []) as Sponsor[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  // Load replays + quadras from LOCAL arena DB
  useEffect(() => {
    if (!arena?.supabase_url || !arena?.supabase_anon_key) return;
    (async () => {
      setLocalError(null);
      try {
        const local = getArenaClient(arena.supabase_url!, arena.supabase_anon_key!);
        const [{ data: q, error: qErr }, { data: r, error: rErr }] = await Promise.all([
          local.from("quadras").select("id,nome").order("nome"),
          local
            .from("replays")
            .select("id,video_url,thumbnail_url,data_evento,hora_evento,quadra_id")
            .order("data_evento", { ascending: false })
            .order("hora_evento", { ascending: false })
            .limit(500),
        ]);
        if (qErr) throw qErr;
        if (rErr) throw rErr;
        setQuadras((q ?? []) as Quadra[]);
        setReplays((r ?? []) as Replay[]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao carregar vídeos";
        setLocalError(msg);
      }
    })();
  }, [arena?.id, arena?.supabase_url, arena?.supabase_anon_key]);

  // Apply primary color CSS var (white-label)
  useEffect(() => {
    if (arena?.primary_color) {
      document.documentElement.style.setProperty("--brand", arena.primary_color);
    }
  }, [arena?.primary_color]);

  const featured = useMemo(() => replays.slice(0, 3), [replays]);

  const availableTimes = useMemo(() => {
    const set = new Set<string>();
    replays
      .filter((r) => (court === "all" || r.quadra_id === court))
      .filter((r) => !date || r.data_evento === format(date, "yyyy-MM-dd"))
      .forEach((r) => set.add(r.hora_evento.slice(0, 5)));
    return Array.from(set).sort();
  }, [replays, court, date]);

  const filtered = useMemo(() => {
    return replays.filter((r) => {
      if (court !== "all" && r.quadra_id !== court) return false;
      if (date && r.data_evento !== format(date, "yyyy-MM-dd")) return false;
      if (time !== "all" && r.hora_evento.slice(0, 5) !== time) return false;
      return true;
    });
  }, [replays, court, date, time]);

  function handleDownload(replay: Replay) {
    if (!user) {
      toast.info("Faça login para baixar o vídeo");
      return;
    }
    const a = document.createElement("a");
    a.href = replay.video_url;
    a.download = `replay-${replay.id}.mp4`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Arena não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const brand = arena.primary_color || "#FF6600";

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {arena.logo_url ? (
              <img src={arena.logo_url} alt={arena.name} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div
                className="grid h-10 w-10 place-items-center rounded-lg font-bold text-white"
                style={{ backgroundColor: brand }}
              >
                {arena.name[0]}
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Replays</p>
              <h1 className="text-base font-bold leading-tight">{arena.name}</h1>
            </div>
          </div>
          {user ? (
            <Link to="/app"><Button size="sm" variant="outline">Minha conta</Button></Link>
          ) : (
            <Link to="/login"><Button size="sm" style={{ backgroundColor: brand }} className="text-white">Entrar</Button></Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {localError && (
          <Card className="my-4 border-destructive/50 p-4 text-sm text-destructive">
            Não foi possível conectar ao banco da arena: {localError}
          </Card>
        )}

        {/* Live Stream */}
        <section className="pt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Câmera Ao Vivo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <LiveStream url="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" brandColor={brand} quadraName="Quadra Principal" />
          </div>
        </section>

        {/* Featured carousel */}
        {featured.length > 0 && (
          <section className="pt-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Destaques</h2>
            <Carousel
              opts={{ loop: true, align: "start" }}
              plugins={[Autoplay({ delay: 4500, stopOnInteraction: true })]}
              className="w-full"
            >
              <CarouselContent>
                {featured.map((r) => (
                  <CarouselItem key={r.id}>
                    <FeaturedCard replay={r} brand={brand} quadras={quadras} onDownload={() => handleDownload(r)} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {featured.length > 1 && (
                <>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </>
              )}
            </Carousel>
          </section>
        )}

        {/* Sponsors */}
        {sponsors.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Patrocinadores</h2>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              {sponsors.map((s) => {
                const inner = (
                  <img src={s.logo_url} alt={s.name} className="h-12 max-w-[120px] object-contain opacity-80 transition hover:opacity-100" />
                );
                return s.link_url ? (
                  <a key={s.id} href={s.link_url} target="_blank" rel="noopener noreferrer">{inner}</a>
                ) : (
                  <span key={s.id}>{inner}</span>
                );
              })}
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Quadra</label>
            <Select value={court} onValueChange={(v) => { setCourt(v); setTime("all"); }}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as quadras</SelectItem>
                {quadras.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd 'de' MMM", { locale: ptBR }) : "Qualquer data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setTime("all"); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
                {date && (
                  <div className="border-t p-2">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { setDate(undefined); setTime("all"); }}>
                      Limpar
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Horário</label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os horários</SelectItem>
                {availableTimes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Feed */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Lances</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} vídeo(s)</span>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              <MapPin className="mx-auto mb-3 h-10 w-10 opacity-30" />
              Nenhum vídeo encontrado para os filtros escolhidos.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((r) => (
                <ReplayCard key={r.id} replay={r} quadras={quadras} brand={brand} onDownload={() => handleDownload(r)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function quadraNome(quadras: Quadra[], id: string | null) {
  if (!id) return "Quadra";
  return quadras.find((q) => q.id === id)?.nome ?? "Quadra";
}

function FeaturedCard({
  replay, brand, quadras, onDownload,
}: { replay: Replay; brand: string; quadras: Quadra[]; onDownload: () => void }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-video w-full bg-black">
        {replay.thumbnail_url ? (
          <img src={replay.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={replay.video_url} className="h-full w-full object-cover" muted />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="text-white">
            <p className="text-xs uppercase tracking-wider opacity-80">{quadraNome(quadras, replay.quadra_id)}</p>
            <p className="text-lg font-bold">{replay.hora_evento.slice(0, 5)} · {format(new Date(replay.data_evento), "dd MMM", { locale: ptBR })}</p>
          </div>
          <div className="flex gap-2">
            <a href={replay.video_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" style={{ backgroundColor: brand }} className="text-white">
                <PlayCircle className="mr-1 h-4 w-4" /> Assistir
              </Button>
            </a>
            <Button size="sm" variant="secondary" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReplayCard({
  replay, quadras, brand, onDownload,
}: { replay: Replay; quadras: Quadra[]; brand: string; onDownload: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-video w-full bg-black">
        {replay.thumbnail_url ? (
          <img src={replay.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={replay.video_url} className="h-full w-full object-cover" muted preload="metadata" />
        )}
        <a
          href={replay.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 grid place-items-center bg-black/0 transition hover:bg-black/30"
        >
          <PlayCircle className="h-12 w-12 text-white opacity-90 drop-shadow-lg" />
        </a>
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: brand }}
        >
          {replay.hora_evento.slice(0, 5)}
        </span>
      </div>
      <div className="flex items-center justify-between p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{quadraNome(quadras, replay.quadra_id)}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(replay.data_evento), "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download className="mr-1 h-4 w-4" /> Baixar
        </Button>
      </div>
    </article>
  );
}
