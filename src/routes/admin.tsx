import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2, Users, Video } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

interface ArenaRow {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  owner_id: string | null;
  created_at: string;
}

function AdminPage() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading, isSuperAdmin } = useAuth();
  const [arenas, setArenas] = useState<ArenaRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [stats, setStats] = useState({ courts: 0, videos: 0, users: 0 });
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: a } = await supabase.from("arenas").select("*").order("created_at", { ascending: false });
    setArenas((a ?? []) as ArenaRow[]);
    const [{ count: c }, { count: v }, { count: u }] = await Promise.all([
      supabase.from("courts").select("*", { count: "exact", head: true }),
      supabase.from("videos").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    setStats({ courts: c ?? 0, videos: v ?? 0, users: u ?? 0 });
  }

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/acesso-negado" />;
  if (path !== "/admin") return <Outlet />;

  async function createArena(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let ownerId: string | null = null;
    if (ownerEmail) {
      const { data: prof } = await supabase.from("profiles").select("id").ilike("full_name", ownerEmail).maybeSingle();
      ownerId = prof?.id ?? null;
    }
    const { data, error } = await supabase
      .from("arenas")
      .insert({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"), owner_id: ownerId })
      .select()
      .single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (ownerId && data) {
      await supabase.from("user_roles").insert({ user_id: ownerId, role: "admin_arena", arena_id: data.id });
    }
    toast.success("Arena criada!");
    setName(""); setSlug(""); setOwnerEmail("");
    setBusy(false);
    load();
  }

  async function toggleActive(a: ArenaRow) {
    await supabase.from("arenas").update({ active: !a.active }).eq("id", a.id);
    load();
  }

  return (
    <AppShell title="Painel SuperAdmin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">SuperAdmin</h1>
        <p className="text-muted-foreground">Gerencie todas as arenas da plataforma</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Arenas" value={arenas.length} />
        <StatCard icon={<Video className="h-5 w-5" />} label="Quadras" value={stats.courts} />
        <StatCard icon={<Video className="h-5 w-5" />} label="Vídeos" value={stats.videos} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Usuários" value={stats.users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Arenas</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {arenas.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3 text-muted-foreground">/{a.slug}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${a.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {a.active ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/admin/arena/$id" params={{ id: a.id }}>Configurar</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(a)}>
                        {a.active ? "Desativar" : "Ativar"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {arenas.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma arena cadastrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Nova arena</h2>
          <form onSubmit={createArena} className="space-y-4">
            <div>
              <Label>Nome da arena</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Arena Boa Vista" />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="boa-vista" />
            </div>
            <div>
              <Label>Nome do dono (opcional)</Label>
              <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Buscar por nome no perfil" />
              <p className="mt-1 text-xs text-muted-foreground">O usuário deve ter conta criada.</p>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Criando..." : "Criar arena"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function FullLoader() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}
