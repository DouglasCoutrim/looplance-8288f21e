import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Arena { id: string; name: string; slug: string; logo_url: string | null; }
interface Court { id: string; name: string; }
interface Video { id: string; title: string; video_url: string; court_id: string | null; created_at: string; }

export const Route = createFileRoute("/a/$slug")({
  component: PlayerFeed,
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
});

function PlayerFeed() {
  const { slug } = Route.useParams();
  const { q } = useSearch({ from: "/a/$slug" });
  const { user, loading, isSuperAdmin, adminArenaId, playerArenaIds } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data: a } = await supabase.from("arenas").select("*").eq("slug", slug).maybeSingle();
      if (!a) { setAccessChecked(true); return; }
      setArena(a as Arena);

      const allowed = isSuperAdmin || adminArenaId === a.id || playerArenaIds.includes(a.id);
      if (allowed) {
        setHasAccess(true);
      } else if (q) {
        // Auto-enroll via QR token
        const { data: court } = await supabase.from("courts").select("id, arena_id").eq("qr_token", q).maybeSingle();
        if (court && court.arena_id === a.id) {
          setEnrolling(true);
          const { error } = await supabase.from("user_roles").insert({
            user_id: user.id, role: "player", arena_id: a.id,
          });
          setEnrolling(false);
          if (!error) { toast.success(`Você entrou na ${a.name}!`); setHasAccess(true); }
          else toast.error("Não foi possível entrar nesta arena");
        }
      }
      setAccessChecked(true);
    })();
  }, [loading, user, slug, q, isSuperAdmin, adminArenaId, playerArenaIds]);

  useEffect(() => {
    if (!arena || !hasAccess) return;
    (async () => {
      const [{ data: c }, { data: v }] = await Promise.all([
        supabase.from("courts").select("id, name").eq("arena_id", arena.id).order("name"),
        supabase.from("videos").select("*").eq("arena_id", arena.id).order("created_at", { ascending: false }),
      ]);
      setCourts((c ?? []) as Court[]);
      setVideos((v ?? []) as Video[]);
    })();
  }, [arena, hasAccess]);

  if (loading || enrolling) return <FullLoader />;
  if (!user) return <Navigate to="/login" />;
  if (!accessChecked) return <FullLoader />;

  if (!arena) {
    return <CenteredMsg title="Arena não encontrada" desc="Verifique o link e tente novamente." />;
  }
  if (!hasAccess) {
    return <CenteredMsg title="Acesso restrito" desc={`Você não tem acesso à ${arena.name}. Escaneie o QR Code da quadra para entrar.`} />;
  }

  const filtered = selectedCourt ? videos.filter((v) => v.court_id === selectedCourt) : videos;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {arena.logo_url
              ? <img src={arena.logo_url} alt={arena.name} className="h-9 w-9 rounded-md object-contain" />
              : <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/20 text-primary font-bold">{arena.name[0]}</div>}
            <div>
              <p className="text-xs text-muted-foreground">Arena</p>
              <h1 className="text-sm font-bold leading-tight">{arena.name}</h1>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            <CourtPill active={!selectedCourt} onClick={() => setSelectedCourt(null)}>Todas</CourtPill>
            {courts.map((c) => (
              <CourtPill key={c.id} active={selectedCourt === c.id} onClick={() => setSelectedCourt(c.id)}>{c.name}</CourtPill>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-10 w-10 opacity-30" />
            Nenhum vídeo nesta seleção ainda.
          </div>
        )}
        {filtered.map((v) => {
          const courtName = courts.find((c) => c.id === v.court_id)?.name;
          return (
            <article key={v.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <video src={v.video_url} controls playsInline className="aspect-video w-full bg-black" />
              <div className="p-4">
                <h2 className="font-semibold">{v.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {courtName ? `${courtName} · ` : ""}{new Date(v.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CourtPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

function CenteredMsg({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-sm text-center">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        <Button className="mt-6" onClick={() => supabase.auth.signOut()}>Sair</Button>
      </div>
    </div>
  );
}

function FullLoader() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}
