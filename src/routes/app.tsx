import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({ component: AppRedirect });

function AppRedirect() {
  const { user, loading, isSuperAdmin, adminArenaId, playerArenaIds } = useAuth();
  const [arenaSlug, setArenaSlug] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const arenaId = adminArenaId ?? playerArenaIds[0];
    if (!arenaId) { setResolved(true); return; }
    supabase.from("arenas").select("slug").eq("id", arenaId).maybeSingle().then(({ data }) => {
      setArenaSlug(data?.slug ?? null);
      setResolved(true);
    });
  }, [loading, user, adminArenaId, playerArenaIds]);

  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" />;
  if (isSuperAdmin) return <Navigate to="/admin" />;
  if (!resolved) return <FullLoader />;
  if (adminArenaId && arenaSlug) return <Navigate to="/arena" />;
  if (playerArenaIds.length > 0 && arenaSlug) return <Navigate to="/a/$slug" params={{ slug: arenaSlug }} />;
  return <NoAccess />;
}

function FullLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function NoAccess() {
  return (
    <AppShell>
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-2xl font-bold">Sem acesso atribuído</h2>
        <p className="mt-2 text-muted-foreground">
          Sua conta ainda não está vinculada a nenhuma arena. Procure o administrador da arena
          para receber o convite ou escaneie o QR Code da quadra.
        </p>
        <Button className="mt-6" onClick={() => supabase.auth.signOut()}>Sair</Button>
      </div>
    </AppShell>
  );
}
