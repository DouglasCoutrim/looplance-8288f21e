import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BottomNav } from "@/components/BottomNav";
import logoMark from "@/assets/logo-mark.png";
import { ChevronRight, Loader2, MapPin, Radio, Search, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterCity, setFilterCity] = useState("all");

  useEffect(() => {
    (async () => {
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

  const states = useMemo(() => {
    const s = new Set<string>();
    arenas.forEach((a) => { if (a.state) s.add(a.state); });
    return Array.from(s).sort();
  }, [arenas]);

  const cities = useMemo(() => {
    const c = new Set<string>();
    arenas.filter((a) => filterState === "all" || a.state === filterState)
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

  const enterArena = (id: string) => navigate({ to: "/arena/$id", params: { id } });

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logoMark} alt="LoopLance" className="h-7 w-7" />
            <span className="text-base font-extrabold tracking-tight">
              Loop<span className="text-primary">Lance</span>
            </span>
          </div>
          <button
            onClick={() => navigate({ to: "/perfil" })}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-primary"
            aria-label="Perfil"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {/* Seletor */}
        <section>
          <h1 className="text-2xl font-extrabold leading-tight">
            Encontre sua <span className="text-primary">arena</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Veja lances ao vivo e gere seus melhores replays.</p>

          <div className="mt-4 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar arena ou cidade…" className="h-11 pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterState} onValueChange={(v) => { setFilterState(v); setFilterCity("all"); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos estados</SelectItem>
                  {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas cidades</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

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
