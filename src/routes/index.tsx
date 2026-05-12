import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoMark from "@/assets/logo-mark.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, PlayCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  component: GlobalPortal,
  head: () => ({
    meta: [
      { title: "LoopLance — Repita a emoção" },
      { name: "description", content: "Portal Global com os melhores lances de todas as arenas LoopLance." },
    ],
  }),
});

interface Arena { id: string; name: string; slug: string; primary_color: string; logo_url: string | null; }
interface GlobalReplay {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  arena_id: string;
  arena?: Arena;
}

function GlobalPortal() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fetch public arenas list for selector
      const { data: aData } = await supabase.from("public_arenas" as never).select("*");
      if (aData) setArenas(aData as Arena[]);

      // Fetch global replays
      const { data: rData } = await supabase
        .from("global_replays" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (rData) {
        // Map arenas into replays
        const mapped = (rData as any[]).map(r => ({
          ...r,
          arena: (aData as Arena[])?.find(a => a.id === r.arena_id)
        }));
        setReplays(mapped);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoMark} alt="LoopLance" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">LoopLance</span>
          </div>
          <div className="flex gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header Hero / Arena Selector */}
        <div className="mb-10 text-center">
          <h1 className="mb-4 text-3xl font-extrabold md:text-5xl">Portal Global</h1>
          <p className="mb-8 text-muted-foreground mx-auto max-w-xl">
            Acompanhe os melhores momentos de todas as quadras conectadas ao LoopLance.
          </p>

          <div className="mx-auto max-w-sm text-left">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Ir para a página da Arena:</label>
            <Select onValueChange={(slug) => { window.location.href = `/play/${slug}`; }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma Arena" />
              </SelectTrigger>
              <SelectContent>
                {arenas.map(a => (
                  <SelectItem key={a.id} value={a.slug}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Global Feeds */}
        {loading ? (
          <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : replays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-10 w-10 opacity-30" />
            Nenhum replay global no momento.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {replays.map(r => (
              <article key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition">
                <div className="relative aspect-video w-full bg-black">
                  {r.thumbnail_url ? (
                    <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={r.video_url} className="h-full w-full object-cover" muted preload="metadata" />
                  )}
                  <a href={r.video_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center bg-black/0 transition hover:bg-black/30">
                    <PlayCircle className="h-10 w-10 text-white opacity-90 drop-shadow" />
                  </a>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex gap-3 items-center min-w-0">
                    {r.arena?.logo_url ? (
                      <img src={r.arena.logo_url} alt="" className="h-8 w-8 rounded-md bg-white object-contain" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md font-bold text-white text-xs" style={{ backgroundColor: r.arena?.primary_color || '#ff6600' }}>
                        {r.arena?.name?.[0] || '?'}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="truncate text-sm font-semibold">{r.arena?.name || 'Arena Desconhecida'}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.created_at ? format(new Date(r.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR }) : "Recente"}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
