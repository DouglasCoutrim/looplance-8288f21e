import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, MapPin, PlayCircle, Radio, Star, RotateCcw, RotateCw, Download } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { resolveReplayUrl } from "@/lib/replays";

import { VideoActions } from "@/components/VideoActions";


export const Route = createFileRoute("/arena/$id")({
  component: ArenaDashboard,
  head: ({ params }) => ({
    meta: [{ title: `Arena · LoopLance`, name: "description", content: `Player ao vivo, replays e edição.` }],
  }),
});

interface PublicArena {
  id: string; slug: string; name: string;
  logo_url: string | null; primary_color: string;
  city: string | null; state: string | null;
}
interface Court { id: string; name: string }
interface Replay {
  id: string; video_url: string; thumbnail_url: string | null;
  data_evento: string; hora_evento: string; court_id: string | null;
}

function ArenaDashboard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [arena, setArena] = useState<PublicArena | null>(null);
  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState<Court[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [selected, setSelected] = useState<Replay | null>(null);
  const [editing, setEditing] = useState<Replay | null>(null);
  const [favorited, setFavorited] = useState(false);
  

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("public_arenas" as never)
        .select("*").eq("id", id).maybeSingle();
      setArena(data as PublicArena | null);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (arena?.primary_color) document.documentElement.style.setProperty("--brand", arena.primary_color);
  }, [arena?.primary_color]);

  useEffect(() => {
    if (!arena?.id) return;
    (async () => {
      const { data: q } = await supabase.from("courts").select("id,name").eq("arena_id", arena.id).order("name");
      setCourts((q ?? []) as Court[]);

      let rows: any[] = [];
      
      try {
        const { data, error } = await supabase.from("replays")
          .select("id,video_url,created_at,court_id")
          .eq("arena_id", arena.id)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        rows = data || [];
      } catch (err) {
        console.error("Erro ao carregar vídeos:", err);
        toast.error("Não foi possível carregar os lances recentes.");
      }

      const rs = rows.map((video: any) => {
        const date = new Date(video.created_at);
        return {
          id: video.id,
          video_url: video.video_url,
          thumbnail_url: null,
          data_evento: format(date, "yyyy-MM-dd"),
          hora_evento: date.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          court_id: video.court_id,
        };
      });
      setReplays(rs);
      setSelected(rs[0] ?? null);
    })();
  }, [arena?.id]);

  useEffect(() => {
    if (!user || !arena) return;
    (async () => {
      const { data } = await supabase.from("favorite_arenas" as never)
        .select("id").eq("user_id", user.id).eq("arena_id", arena.id).maybeSingle();
      setFavorited(!!data);
    })();
  }, [user, arena?.id]);

  async function toggleFav() {
    if (!user || !arena) return;
    if (favorited) {
      await supabase.from("favorite_arenas" as never).delete().eq("user_id", user.id).eq("arena_id", arena.id);
      setFavorited(false);
    } else {
      await supabase.from("favorite_arenas" as never).insert({ user_id: user.id, arena_id: arena.id } as never);
      setFavorited(true);
    }
  }
  const grouped = useMemo(() => {
    const m = new Map<string, Replay[]>();
    replays.forEach((r) => {
      const key = `${r.data_evento}T${r.hora_evento.slice(0, 2)}:00`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [replays]);

  const isLive = useMemo(() => {
    if (!replays.length) return false;
    const last = new Date(replays[0].data_evento + "T" + replays[0].hora_evento).getTime();
    return Date.now() - last < 10 * 60 * 1000;
  }, [replays]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand,#FF6600)" }} /></div>;
  }
  if (!arena) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Arena não encontrada</h1>
          <Link to="/"><Button className="mt-4">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  const brand = arena.primary_color || "#FF6600";

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate({ to: "/" })} className="rounded-md p-1 hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {arena.logo_url ? (
              <img src={arena.logo_url} alt="" className="h-12 w-12 rounded-md object-contain" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-md text-lg font-bold text-white" style={{ backgroundColor: brand }}>
                {arena.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight">{arena.name}</h1>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[arena.city, arena.state].filter(Boolean).join(" · ") || "—"}
                {isLive && <Badge className="ml-2 border-0 bg-red-600 text-[9px] text-white"><Radio className="mr-0.5 h-2.5 w-2.5 animate-pulse" />AO VIVO</Badge>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={toggleFav} aria-label="Favoritar">
              <Star className={`h-5 w-5 ${favorited ? "fill-primary text-primary" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <section className="pt-4">
          <PlayerWithControls selected={selected} brand={brand} onEdit={() => selected && setEditing(selected)} />
          {selected && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm">
                <p className="font-semibold">
                  {courtName(courts, selected.court_id)} · {selected.hora_evento.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selected.data_evento), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Quadras Disponíveis */}
        {courts.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider">Quadras Disponíveis</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {courts.map((q) => {
                const items = replays.filter((r) => r.court_id === q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => items[0] && setSelected(items[0])}
                    className="group relative overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/60"
                  >
                    <div className="relative aspect-square w-full"
                      style={{ background: `linear-gradient(135deg, ${brand}33, #000 70%)` }}>
                      {arena.logo_url && (
                        <img src={arena.logo_url} alt="" className="absolute inset-0 m-auto h-12 w-12 object-contain opacity-40" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                        <p className="truncate text-sm font-bold text-white">{q.name}</p>
                        <p className="text-[10px] text-white/60">{items.length} lance(s)</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-6">
          <Tabs defaultValue="recent">
            <TabsList>
              <TabsTrigger value="recent">Por horário</TabsTrigger>
              <TabsTrigger value="court">Por quadra</TabsTrigger>
            </TabsList>

            <TabsContent value="recent" className="mt-4 space-y-6">
              {grouped.length === 0 && <EmptyVideos />}
              {grouped.map(([key, items]) => (
                <div key={key}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {format(new Date(key), "dd MMM · HH:00", { locale: ptBR })}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {items.map((r) => (
                      <ThumbCard key={r.id} replay={r} brand={brand} active={selected?.id === r.id}
                        onSelect={() => setSelected(r)} onEdit={() => setEditing(r)} courts={courts} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="court" className="mt-4 space-y-6">
              {courts.length === 0 && <EmptyVideos />}
              {courts.map((q) => {
                const items = replays.filter((r) => r.court_id === q.id);
                if (!items.length) return null;
                return (
                  <div key={q.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{q.name}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {items.map((r) => (
                        <ThumbCard key={r.id} replay={r} brand={brand} active={selected?.id === r.id}
                          onSelect={() => setSelected(r)} onEdit={() => setEditing(r)} courts={courts} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <BottomNav />

      {/* ReplayEditor removido conforme nova abordagem simplificada */}
    </div>
  );
}

function PlayerWithControls({
  selected, brand, onEdit,
}: { selected: Replay | null; brand: string; onEdit: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !selected) return;
    const url = resolveReplayUrl(selected.video_url);
    if (v.src !== url) {
      v.src = url;
      v.load();
    }
  }, [selected]);

  function nudge(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || 1e9), v.currentTime + delta));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      {selected ? (
        <video
          ref={videoRef}
          controls
          playsInline
          className="aspect-video w-full bg-black"
          poster={selected.thumbnail_url ? resolveReplayUrl(selected.thumbnail_url) : undefined}
        />
      ) : (
        <div className="aspect-video w-full grid place-items-center text-white/60">
          <div className="text-center">
            <PlayCircle className="mx-auto mb-2 h-12 w-12 opacity-40" />
            <p className="text-sm">Selecione um replay abaixo</p>
          </div>
        </div>
      )}
      {selected && (
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-black p-2">
          <div className="flex gap-2">
            <button
              onClick={() => nudge(-5)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
              aria-label="Voltar 5 segundos"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="sr-only">-5s</span>
            </button>
            <button
              onClick={() => nudge(15)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
              aria-label="Avançar 15 segundos"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <a
            href={resolveReplayUrl(selected.video_url)}
            download
            className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-extrabold shadow-lg transition active:scale-95"
            style={{ backgroundColor: brand, color: "#fff" }}
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      )}
      {selected && (
        <div className="border-t border-white/10 bg-black p-2">
          <VideoActions url={resolveReplayUrl(selected.video_url)} title="Replay LoopLance" />
        </div>
      )}
    </div>
  );
}

function EmptyVideos() {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      Nenhum replay disponível ainda.
    </div>
  );
}

function courtName(courts: Court[], id: string | null) {
  if (!id) return "Quadra";
  // Tenta encontrar por ID exato ou por substring no nome (ex: "1" em "Quadra 1")
  const found = courts.find((q) => q.id === id || q.name.toLowerCase().includes(id.toLowerCase()));
  return found?.name ?? `Quadra ${id}`;
}

function ThumbCard({
  replay, active, onSelect, onEdit, brand, courts,
}: {
  replay: Replay; active: boolean; onSelect: () => void; onEdit: () => void;
  brand: string; courts: Court[];
}) {
  return (
    <div className={`group overflow-hidden rounded-xl border bg-card transition ${active ? "ring-2" : "border-border"}`}
      style={{ borderColor: active ? brand : undefined, boxShadow: active ? `0 0 0 1px ${brand}` : undefined }}>
      <button onClick={onSelect} className="relative block aspect-video w-full bg-black">
        {replay.thumbnail_url
          ? <img src={resolveReplayUrl(replay.thumbnail_url)} alt="" className="h-full w-full object-cover" />
          : <video src={resolveReplayUrl(replay.video_url)} className="h-full w-full object-cover" muted preload="metadata" />}
        <span className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: brand }}>
          {replay.hora_evento.slice(0, 5)}
        </span>
      </button>
      <div className="flex items-center justify-between gap-1 p-2">
        <p className="truncate text-[11px] text-muted-foreground">{courtName(courts, replay.court_id)}</p>
      </div>
    </div>
  );
}
