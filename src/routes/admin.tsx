import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { inviteArenaOwner } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Building2, Loader2, Mail, Trash2, Users, Video } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

interface ArenaRow {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  owner_id: string | null;
  created_at: string;
}

type RoleName = "superadmin" | "admin_arena" | "player";
interface ProfileRow { id: string; full_name: string | null }
interface RoleRow { user_id: string; role: RoleName; arena_id: string | null }
interface UserWithRoles extends ProfileRow { roles: RoleRow[] }

function AdminPage() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading, isSuperAdmin } = useAuth();
  const [arenas, setArenas] = useState<ArenaRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [stats, setStats] = useState({ courts: 0, videos: 0, users: 0 });
  const [busy, setBusy] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<UserWithRoles[]>([]);

  async function load() {
    const { data: a } = await supabase.from("arenas").select("*").order("created_at", { ascending: false });
    setArenas((a ?? []) as ArenaRow[]);
    const [{ count: c }, { count: v }, { count: u }] = await Promise.all([
      supabase.from("courts").select("*", { count: "exact", head: true }),
      supabase.from("videos").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    setStats({ courts: c ?? 0, videos: v ?? 0, users: u ?? 0 });

    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role,arena_id"),
    ]);
    const rolesByUser = new Map<string, RoleRow[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r as RoleRow);
      rolesByUser.set(r.user_id, arr);
    });
    setGlobalUsers((profs ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] })));
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

  async function deleteArena(a: ArenaRow) {
    const { error } = await supabase.from("arenas").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(`Arena "${a.name}" excluída`);
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

      <Tabs defaultValue="arenas">
        <TabsList className="mb-4">
          <TabsTrigger value="arenas">Arenas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários globais</TabsTrigger>
        </TabsList>

        <TabsContent value="arenas">
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir arena "{a.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação remove permanentemente a arena e todos os dados vinculados (quadras, vídeos, câmeras, placas, botões e vínculos de usuários). Não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteArena(a)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
        </TabsContent>

        <TabsContent value="usuarios">
          <GlobalUsersCard users={globalUsers} arenas={arenas} onChange={load} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function GlobalUsersCard({ users, arenas, onChange }: { users: UserWithRoles[]; arenas: ArenaRow[]; onChange: () => void }) {
  const arenaName = (id: string | null) => arenas.find((a) => a.id === id)?.name ?? "—";
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) =>
    !search.trim() || (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) || u.id.includes(search)
  );

  async function setRole(userId: string, role: RoleName, arenaId: string | null) {
    if (role === "admin_arena" && !arenaId) return toast.error("Selecione uma arena");
    // Remove conflicting roles for this user before promoting
    if (role === "superadmin") {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    } else if (role === "admin_arena") {
      await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", "player");
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, arena_id: arenaId });
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado");
    onChange();
  }

  async function removeRole(userId: string, role: RoleName, arenaId: string | null) {
    let q = supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (arenaId) q = q.eq("arena_id", arenaId); else q = q.is("arena_id", null);
    const { error } = await q;
    if (error) return toast.error(error.message);
    onChange();
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Usuários globais</h2>
          <p className="text-sm text-muted-foreground">Todo novo usuário entra como Jogador. Promova manualmente para Admin de Arena ou SuperAdmin.</p>
        </div>
        <Input className="max-w-xs" placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Usuário</th>
              <th className="p-3">Papéis atuais</th>
              <th className="p-3">Promover</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <PromoteRow key={u.id} user={u} arenas={arenas} arenaName={arenaName} onPromote={setRole} onRemove={removeRole} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum usuário</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PromoteRow({
  user, arenas, arenaName, onPromote, onRemove,
}: {
  user: UserWithRoles;
  arenas: ArenaRow[];
  arenaName: (id: string | null) => string;
  onPromote: (uid: string, role: RoleName, arenaId: string | null) => void;
  onRemove: (uid: string, role: RoleName, arenaId: string | null) => void;
}) {
  const [target, setTarget] = useState<RoleName>("player");
  const [arenaId, setArenaId] = useState<string>("");

  return (
    <tr className="border-t border-border align-top">
      <td className="p-3">
        <p className="font-medium">{user.full_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{user.id}</p>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              {labelRole(r.role)}{r.arena_id ? ` · ${arenaName(r.arena_id)}` : ""}
              <button className="text-destructive hover:text-destructive/80" onClick={() => onRemove(user.id, r.role, r.arena_id)} title="Remover">×</button>
            </span>
          ))}
          {user.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={target} onValueChange={(v) => setTarget(v as RoleName)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="player">Jogador</SelectItem>
              <SelectItem value="admin_arena">Admin de Arena</SelectItem>
              <SelectItem value="superadmin">SuperAdmin</SelectItem>
            </SelectContent>
          </Select>
          {target === "admin_arena" && (
            <Select value={arenaId} onValueChange={setArenaId}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Arena..." /></SelectTrigger>
              <SelectContent>
                {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => onPromote(user.id, target, target === "admin_arena" ? arenaId || null : null)}>
            Aplicar
          </Button>
        </div>
      </td>
    </tr>
  );
}

function labelRole(r: RoleName) {
  return r === "superadmin" ? "SuperAdmin" : r === "admin_arena" ? "Admin Arena" : "Jogador";
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
