import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ChevronRight, Film, HelpCircle, LogIn, LogOut, Settings, Shield, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({ meta: [{ title: "Perfil — LoopLance" }] }),
});

interface Profile { full_name: string | null; avatar_url: string | null }

function PerfilPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, adminArenaId, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile((data as Profile | null) ?? null));
  }, [user]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="border-b border-border px-4 pb-6 pt-8 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-primary bg-card">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <UserIcon className="h-9 w-9 text-primary" />
          )}
        </div>
        <h1 className="mt-3 text-lg font-extrabold">
          {loading ? "…" : profile?.full_name ?? user?.email ?? "Visitante"}
        </h1>
        <p className="text-xs text-muted-foreground">{user?.email ?? "Faça login para usar todos os recursos"}</p>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {!user ? (
          <Button asChild className="w-full" size="lg">
            <Link to="/login"><LogIn className="mr-2 h-4 w-4" />Entrar</Link>
          </Button>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            <Row icon={Film} label="Meus replays" onClick={() => navigate({ to: "/meus-replays" })} />
            {(isSuperAdmin || adminArenaId) && (
              <Row icon={Shield} label="Painel administrativo"
                onClick={() => navigate({ to: isSuperAdmin ? "/admin" : "/painel" })} />
            )}
            <Row icon={Settings} label="Configurações" onClick={() => {}} disabled />
            <Row icon={HelpCircle} label="Ajuda" onClick={() => {}} disabled />
            <Row icon={LogOut} label="Sair" onClick={signOut} danger />
          </ul>
        )}

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          LoopLance · v1.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}

function Row({
  icon: Icon, label, onClick, danger, disabled,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition last:border-b-0 ${
          disabled ? "opacity-40" : "hover:bg-accent/10"
        } ${danger ? "text-red-400" : ""}`}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-sm font-medium">{label}</span>
        {!disabled && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
    </li>
  );
}
