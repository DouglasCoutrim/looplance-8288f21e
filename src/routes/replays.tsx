import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { ChevronRight, Loader2, MapPin, Search } from "lucide-react";

export const Route = createFileRoute("/replays")({
  component: ReplaysIndex,
  head: () => ({ meta: [{ title: "Replays — LoopLance" }] }),
});

interface Arena {
  id: string; name: string; slug: string;
  primary_color: string; logo_url: string | null;
  city: string | null; state: string | null;
}

function ReplaysIndex() {
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_arenas" as never).select("*").order("name");
      setArenas((data ?? []) as Arena[]);
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? arenas.filter((a) => a.name.toLowerCase().includes(q) || (a.city ?? "").toLowerCase().includes(q))
    : arenas;

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-extrabold">Replays por arena</h1>
        <p className="text-xs text-muted-foreground">Navegue pelo histórico de qualquer arena.</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar arena ou cidade…" className="h-10 pl-9" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
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
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                Nenhuma arena encontrada.
              </li>
            )}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
