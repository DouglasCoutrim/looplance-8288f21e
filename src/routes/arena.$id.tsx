import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, MapPin, PlayCircle, Scissors, Radio, Star, RotateCcw, RotateCw } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { resolveReplayUrl } from "@/lib/replays";

import { VideoActions } from "@/components/VideoActions";
import { BucketVideoFeed } from "@/components/BucketVideoFeed";

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
  supabase_url: string | null; supabase_anon_key: string | null;
}
interface Quadra { id: string; nome: string }
interface Replay {
  id: string; video_url: string; thumbnail_url: string | null;
  data_evento: string; hora_evento: string; quadra_id: string | null;
}

function ArenaDashboard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [arena, setArena] = useState<PublicArena | null>(null);
  const [loading, setLoading] = useState(true);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
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
      setQuadras(((q ?? []) as { id: string; name: string }[]).map((court) => ({ id: court.id, nome: court.name })));

      const useExternal = Boolean(arena.supabase_url && arena.supabase_anon_key);
      
      let rows: any[] = [];
      
      try {
        if (useExternal) {
          const { data, error } = await supabase.functions.invoke("list-arena-videos", {
            body: { arenaId: arena.id, type: "videos" },
          });
          if (error) throw error;
          rows = data?.videos || [];
        } else {
          const { data, error } = await supabase.from("videos")
            .select("id,video_url,thumbnail_url,created_at,court_id")
            .eq("arena_id", arena.id)
            .order("created_at", { ascending: false })
            .limit(500);
          if (error) throw error;
          rows = data || [];
        }
      } catch (err) {
        console.error("Erro ao carregar vídeos:", err);
        toast.error("Não foi possível carregar os lances recentes.");
      }

      const rs = rows.map((video: any) => {
        const date = new Date(video.created_at);
        return {
          id: video.id,
          video_url: video.video_url,
          thumbnail_url: video.thumbnail_url,
          data_evento: format(date, "yyyy-MM-dd"),
          hora_evento: date.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
          quadra_id: video.court_id,
        };
      });
      setReplays(rs);
      setSelected(rs[0] ?? null);
    })();
  }, [arena?.id, arena?.supabase_url, arena?.supabase_anon_key]);

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
                  {quadraNome(quadras, selected.quadra_id)} · {selected.hora_evento.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selected.data_evento), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Quadras Disponíveis */}
        {quadras.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider">Quadras Disponíveis</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quadras.map((q) => {
                const items = replays.filter((r) => r.quadra_id === q.id);
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
                        <p className="truncate text-sm font-bold text-white">{q.nome}</p>
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
              <TabsTrigger value="bucket">Bucket</TabsTrigger>
            </TabsList>

            <TabsContent value="bucket" className="mt-4">
              <BucketVideoFeed
                arenaId={arena.id}
                bucket="replays"
                brand={brand}
              />
            </TabsContent>

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
                        onSelect={() => setSelected(r)} onEdit={() => setEditing(r)} quadras={quadras} />
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="court" className="mt-4 space-y-6">
              {quadras.length === 0 && <EmptyVideos />}
              {quadras.map((q) => {
                const items = replays.filter((r) => r.quadra_id === q.id);
                if (!items.length) return null;
                return (
                  <div key={q.id}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{q.nome}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {items.map((r) => (
                        <ThumbCard key={r.id} replay={r} brand={brand} active={selected?.id === r.id}
                          onSelect={() => setSelected(r)} onEdit={() => setEditing(r)} quadras={quadras} />
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

      {editing && (
        <ReplayEditor
          replay={editing}
          arena={arena}
          brand={brand}
          user={user}
          onClose={() => setEditing(null)}
        />
      )}
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
            <span className="grid place-items-center text-[10px] font-bold text-white/60">-5s</span>
            <span className="grid place-items-center text-[10px] font-bold text-white/60">+15s</span>
            <button
              onClick={() => nudge(15)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
              aria-label="Avançar 15 segundos"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onEdit}
            style={{ backgroundColor: brand, color: "#fff" }}
            className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-extrabold shadow-lg transition active:scale-95"
          >
            <Scissors className="h-4 w-4" /> Editar
          </button>
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

function quadraNome(quadras: Quadra[], id: string | null) {
  if (!id) return "Quadra";
  // Tenta encontrar por ID exato ou por substring no nome (ex: "1" em "Quadra 1")
  const found = quadras.find((q) => q.id === id || q.nome.toLowerCase().includes(id.toLowerCase()));
  return found?.nome ?? `Quadra ${id}`;
}

function ThumbCard({
  replay, active, onSelect, onEdit, brand, quadras,
}: {
  replay: Replay; active: boolean; onSelect: () => void; onEdit: () => void;
  brand: string; quadras: Quadra[];
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
        <p className="truncate text-[11px] text-muted-foreground">{quadraNome(quadras, replay.quadra_id)}</p>
        <button onClick={onEdit} title="Gerar replay" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Scissors className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface Crop { x: number; y: number; w: number; h: number }
type Aspect = "9:16" | "1:1" | "16:9";

function ReplayEditor({
  replay, arena, brand, user, onClose,
}: {
  replay: Replay; arena: PublicArena; brand: string;
  user: ReturnType<typeof useAuth>["user"]; onClose: () => void;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const clipLen = 30;
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [crop, setCrop] = useState<Crop>({ x: 0.25, y: 0.1, w: 0.5, h: 0.8 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const r = aspect === "9:16" ? 9 / 16 : aspect === "1:1" ? 1 : 16 / 9;
    setCrop((c) => {
      const newW = Math.min(1, c.h * (r / (16 / 9)));
      const x = Math.min(Math.max(c.x + c.w / 2 - newW / 2, 0), 1 - newW);
      return { x, y: c.y, w: newW, h: c.h };
    });
  }, [aspect]);

  function onLoaded() {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration || 0);
      v.currentTime = start;
    }
  }

  function seek(s: number) {
    setStart(s);
    if (videoRef.current) videoRef.current.currentTime = s;
  }

  const dragRef = useRef<{ kind: "move" | "resize" | null; sx: number; sy: number; orig: Crop }>({ kind: null, sx: 0, sy: 0, orig: crop });
  function startDrag(e: React.PointerEvent, kind: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, orig: crop };
  }
  function onDrag(e: React.PointerEvent) {
    if (!dragRef.current.kind || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.sx) / rect.width;
    const dy = (e.clientY - dragRef.current.sy) / rect.height;
    const o = dragRef.current.orig;
    if (dragRef.current.kind === "move") {
      setCrop({
        x: clamp(o.x + dx, 0, 1 - o.w),
        y: clamp(o.y + dy, 0, 1 - o.h),
        w: o.w, h: o.h,
      });
    } else {
      const newH = clamp(o.h + dy, 0.15, 1 - o.y);
      const r = aspect === "9:16" ? 9 / 16 : aspect === "1:1" ? 1 : 16 / 9;
      const newW = clamp(newH * (r / (16 / 9)), 0.1, 1 - o.x);
      setCrop({ x: o.x, y: o.y, w: newW, h: newH });
    }
  }
  function endDrag(e: React.PointerEvent) {
    dragRef.current.kind = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { }
  }

  async function submit() {
    if (!user) {
      toast.info("Faça login para gerar replays");
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("replay_jobs" as never).insert({
      user_id: user.id,
      arena_id: arena.id,
      source_video_url: replay.video_url,
      timestamp_inicio: Number(start.toFixed(2)),
      duracao_segundos: clipLen,
      start_time: Number(start.toFixed(2)),
      end_time: Number((start + clipLen).toFixed(2)),
      coords_json: {
        x: Number(crop.x.toFixed(4)), y: Number(crop.y.toFixed(4)),
        w: Number(crop.w.toFixed(4)), h: Number(crop.h.toFixed(4)),
      },
      crop_x: Number(crop.x.toFixed(4)),
      crop_y: Number(crop.y.toFixed(4)),
      crop_w: Number(crop.w.toFixed(4)),
      crop_h: Number(crop.h.toFixed(4)),
      aspect_ratio: aspect,
      status: "pending",
    } as never);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Replay enviado para processamento!");
    onClose();
    navigate({ to: "/meus-replays" });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Replay</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div ref={stageRef} className="relative aspect-video w-full select-none overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              src={resolveReplayUrl(replay.video_url)}
              onLoadedMetadata={onLoaded}
              className="h-full w-full object-contain"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-black/60" />
              <div
                className="absolute bg-transparent"
                style={{
                  left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                }}
              />
            </div>
            <div
              onPointerDown={(e) => startDrag(e, "move")}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              className="absolute cursor-move border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{
                left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                borderColor: brand,
              }}
            >
              <span className="absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: brand }}>{aspect}</span>
              <div
                onPointerDown={(e) => startDrag(e, "resize")}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm ring-2 ring-black/40"
                style={{ backgroundColor: brand }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <ToggleGroup type="single" value={aspect} onValueChange={(v) => v && setAspect(v as Aspect)}>
              <ToggleGroupItem value="9:16">9:16</ToggleGroupItem>
              <ToggleGroupItem value="1:1">1:1</ToggleGroupItem>
              <ToggleGroupItem value="16:9">16:9</ToggleGroupItem>
            </ToggleGroup>
            <span className="text-xs text-muted-foreground">Clipe de {clipLen}s</span>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Início: {fmt(start)}</span>
              <span>Fim: {fmt(Math.min(start + clipLen, duration))}</span>
            </div>
            <Slider
              value={[start]}
              min={0}
              max={Math.max(0, duration - clipLen)}
              step={0.5}
              onValueChange={(v) => seek(v[0])}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} style={{ backgroundColor: brand }} className="text-white">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}
            Gerar Replay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }
function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
