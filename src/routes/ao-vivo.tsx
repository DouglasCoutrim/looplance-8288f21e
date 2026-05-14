import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Radio } from "lucide-react";

export const Route = createFileRoute("/ao-vivo")({
  component: LivePage,
  head: () => ({ meta: [{ title: "Ao Vivo — LoopLance" }] }),
});

interface Arena {
  id: string; name: string; slug: string;
  primary_color: string; logo_url: string | null;
  city: string | null; state: string | null;
}

const LIVE_THRESHOLD_MS = 10 * 60 * 1000;

function LivePage() {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [a, r] = await Promise.all([
        supabase.from("public_arenas" as never).select("*"),
        supabase.from("global_replays" as never).select("arena_id,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      setArenas((a.data ?? []) as Arena[]);
      const now = Date.now();
      const set = new Set<string>();
      ((r.data ?? []) as { arena_id: string; created_at: string }[]).forEach((x) => {
        if (now - new Date(x.created_at).getTime() < LIVE_THRESHOLD_MS) set.add(x.arena_id);
      });
      setLiveIds(set);
      setLoading(false);
    })();
  }, []);

  const liveArenas = useMemo(() => arenas.filter((a) => liveIds.has(a.id)), [arenas, liveIds]);

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-extrabold">
          <Radio className="mr-2 inline h-5 w-5 text-red-500 animate-pulse" />
          Ao Vivo agora
        </h1>
        <p className="text-xs text-muted-foreground">Arenas com transmissões nos últimos 10 minutos.</p>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : liveArenas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Nenhuma arena ao vivo no momento.
          </div>
        ) : (
          <ul className="space-y-3">
            {liveArenas.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => navigate({ to: "/arena/$id", params: { id: a.id } })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/60"
                >
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg font-bold text-black" style={{ backgroundColor: a.primary_color }}>
                      {a.name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{a.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[a.city, a.state].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Badge className="border-0 bg-red-600 text-white">
                    <Radio className="mr-1 h-3 w-3 animate-pulse" /> AO VIVO
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
