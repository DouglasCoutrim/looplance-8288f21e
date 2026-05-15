import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Trash2, Upload, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/admin/arena/$id")({ component: ArenaDetailPage });

interface Arena {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  city: string | null;
  state: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  videos_bucket: string | null;
  retention_days: number | null;
}
interface Sponsor { id: string; name: string; logo_url: string; link_url: string | null; display_order: number }
interface CamRow { id: string; name: string; rtsp_url: string; button_id: string | null }
interface UserRow { user_id: string; role: string; full_name: string | null }

function ArenaDetailPage() {
  const { id } = Route.useParams();
  const { user, loading, isSuperAdmin } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [cameras, setCameras] = useState<CamRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setPageLoading(true);
    setLoadError(null);
    const { data: a, error: arenaError } = await supabase
      .from("arenas")
      .select("id,name,slug,logo_url,primary_color,city,state,supabase_url,supabase_anon_key,videos_bucket,retention_days")
      .eq("id", id).maybeSingle();
    if (arenaError) {
      setLoadError(arenaError.message);
      setPageLoading(false);
      return;
    }
    setArena(a as Arena | null);
    const [{ data: c, error: cErr }, { data: ur, error: urErr }] = await Promise.all([
      supabase.from("cameras").select("id,name,rtsp_url,button_id").eq("arena_id", id).order("name"),
      supabase.from("user_roles").select("user_id,role").eq("arena_id", id),
    ]);
    const firstError = cErr ?? urErr;
    if (firstError) setLoadError(firstError.message);
    setCameras((c ?? []) as CamRow[]);
    const rows = (ur ?? []) as { user_id: string; role: string }[];
    if (rows.length) {
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      setUsers(rows.map((r) => ({ ...r, full_name: map.get(r.user_id) ?? null })));
    } else setUsers([]);
    setPageLoading(false);
  }

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/acesso-negado" />;
  if (pageLoading) return <AppShell><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;
  if (!arena) return <AppShell><p className="text-muted-foreground">Arena não encontrada.</p></AppShell>;

  return (
    <AppShell title={`Arena · ${arena.name}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
          <div className="flex items-center gap-3">
            {arena.logo_url && <img src={arena.logo_url} alt="" className="h-10 w-10 rounded object-contain bg-muted" />}
            <div>
              <h1 className="text-2xl font-bold">{arena.name}</h1>
              <p className="text-sm text-muted-foreground">/{arena.slug}</p>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/infra">Gerenciar infra global →</Link>
        </Button>
      </div>

      {loadError && (
        <Card className="mb-4 border-destructive/50 p-4 text-sm text-destructive">
          Erro ao carregar parte da configuração: {loadError}
        </Card>
      )}

      <Tabs defaultValue="cameras" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="cameras">Câmeras</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="patrocinadores">Patrocinadores</TabsTrigger>
          <TabsTrigger value="whitelabel">White Label</TabsTrigger>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
        </TabsList>

        <TabsContent value="cameras">
          <CamerasReadOnly cameras={cameras} />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersCard arenaId={id} users={users} onChange={load} />
        </TabsContent>

        <TabsContent value="patrocinadores">
          <SponsorsCard arenaId={id} />
        </TabsContent>

        <TabsContent value="whitelabel">
          <WhiteLabelCard arena={arena} onSaved={load} />
        </TabsContent>

        <TabsContent value="conexao">
          <ConnectionCard arena={arena} onSaved={load} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* -------------------- Cameras read-only (visão do dono) -------------------- */

function CamerasReadOnly({ cameras }: { cameras: CamRow[] }) {
  const statusOf = (c: CamRow): "online" | "offline" =>
    /^rtsps?:\/\/.+/i.test(c.rtsp_url) && Boolean(c.button_id) ? "online" : "offline";

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Câmeras desta arena</h2>
        <p className="text-sm text-muted-foreground">
          Cadastro e mapeamento são gerenciados pelo Super Admin em <Link to="/admin/infra" className="text-primary underline">Infra Global</Link>.
        </p>
      </div>
      <div className="space-y-2">
        {cameras.map((c) => {
          const st = statusOf(c);
          return (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  {st === "online" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
                      <Wifi className="h-3 w-3" /> Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                      <WifiOff className="h-3 w-3" /> Offline
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{c.rtsp_url}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.button_id ? "Vinculada a um pino físico" : "Sem pino vinculado"}
                </p>
              </div>
            </div>
          );
        })}
        {cameras.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma câmera vinculada a esta arena.</p>}
      </div>
    </Card>
  );
}

/* ----------------------------- Patrocinadores ----------------------------- */

function SponsorsCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("arena_sponsors").select("*").eq("arena_id", arenaId).order("display_order");
    setList((data ?? []) as Sponsor[]);
  }
  useEffect(() => { load(); }, [arenaId]);

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome");
    if (!file) return toast.error("Envie a logo do patrocinador");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${arenaId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("sponsors").upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("sponsors").getPublicUrl(path);
      const { error } = await supabase.from("arena_sponsors").insert({
        arena_id: arenaId,
        name: name.trim(),
        logo_url: pub.publicUrl,
        link_url: linkUrl.trim() || null,
        display_order: list.length,
      });
      if (error) throw error;
      toast.success("Patrocinador adicionado");
      setName(""); setLinkUrl(""); pickFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao adicionar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("arena_sponsors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Patrocinadores</h2>
      <form onSubmit={add} className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
        <div>
          <Label>Nome</Label>
          <Input placeholder="Patrocinador" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Link (opcional)</Label>
          <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        </div>
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              {file ? "Trocar imagem" : "Selecionar"}
            </Button>
            {preview && <img src={preview} alt="" className="h-10 w-10 rounded object-contain bg-muted" />}
          </div>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Enviando..." : "Adicionar"}</Button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum patrocinador cadastrado ainda.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <img src={s.logo_url} alt={s.name} className="h-12 w-12 rounded object-contain bg-muted" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                {s.link_url && <p className="truncate text-xs text-muted-foreground">{s.link_url}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------- Usuários da arena ----------------------------- */

function UsersCard({ arenaId, users, onChange }: { arenaId: string; users: UserRow[]; onChange: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; full_name: string | null }[]>([]);
  const [role, setRole] = useState<"admin_arena" | "player">("player");
  const [busy, setBusy] = useState(false);

  async function doSearch() {
    if (!search.trim()) return;
    const { data } = await supabase.from("profiles").select("id,full_name").ilike("full_name", `%${search}%`).limit(10);
    setResults((data ?? []) as any);
  }

  async function addUser(userId: string) {
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role, arena_id: arenaId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Usuário vinculado");
    setResults([]); setSearch(""); onChange();
  }

  async function removeUser(u: UserRow) {
    if (!confirm(`Remover ${u.full_name ?? "usuário"} (${u.role})?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", u.user_id).eq("arena_id", arenaId).eq("role", u.role as any);
    if (error) return toast.error(error.message);
    onChange();
  }

  const admins = users.filter((u) => u.role === "admin_arena");
  const players = users.filter((u) => u.role === "player");

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Vincular usuário</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome do perfil..." />
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_arena">Admin da Arena</SelectItem>
              <SelectItem value="player">Jogador</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={doSearch}>Buscar</Button>
        </div>
        {results.length > 0 && (
          <ul className="mt-3 space-y-1">
            {results.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                <span>{r.full_name ?? r.id}</span>
                <Button size="sm" disabled={busy} onClick={() => addUser(r.id)}>Vincular como {role === "admin_arena" ? "Admin" : "Jogador"}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <UserList title="Admins da Arena" rows={admins} onRemove={removeUser} />
      <UserList title="Jogadores" rows={players} onRemove={removeUser} />
    </div>
  );
}

function UserList({ title, rows, onRemove }: { title: string; rows: UserRow[]; onRemove: (u: UserRow) => void }) {
  return (
    <Card className="p-6">
      <h3 className="mb-3 text-base font-semibold">{title} <span className="text-xs text-muted-foreground">({rows.length})</span></h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Nome</th><th className="p-3">User ID</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={`${u.user_id}-${u.role}`} className="border-t border-border">
                <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{u.user_id}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => onRemove(u)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum vinculado</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------- White Label ----------------------------- */

function WhiteLabelCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [color, setColor] = useState(arena.primary_color);
  const [name, setName] = useState(arena.name);
  const [city, setCity] = useState(arena.city ?? "");
  const [stateUf, setStateUf] = useState(arena.state ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setColor(arena.primary_color);
    setName(arena.name);
    setCity(arena.city ?? "");
    setStateUf(arena.state ?? "");
  }, [arena.id]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("arenas").update({
      primary_color: color,
      name,
      city: city.trim() || null,
      state: stateUf.trim().toUpperCase() || null,
    }).eq("id", arena.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Identidade visual salva"); onSaved();
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${arena.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("arena-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("arena-logos").getPublicUrl(path);
    const { error } = await supabase.from("arenas").update({ logo_url: pub.publicUrl }).eq("id", arena.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Logo atualizada"); onSaved();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">White Label</h2>
      <p className="mb-4 text-sm text-muted-foreground">Identidade visual e localização exibidas ao cliente final.</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label>Nome da arena</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={stateUf} onChange={(e) => setStateUf(e.target.value.slice(0, 2))} placeholder="SP" maxLength={2} />
            </div>
          </div>
          <div>
            <Label>Cor principal</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[140px]" />
            </div>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>

        <div>
          <Label>Logo da arena</Label>
          <div className="mt-2 flex flex-col items-start gap-3">
            <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-border bg-muted">
              {arena.logo_url
                ? <img src={arena.logo_url} alt="logo" className="max-h-full max-w-full object-contain" />
                : <span className="text-xs text-muted-foreground">Sem logo</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />{uploading ? "Enviando..." : "Enviar nova logo"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------- Conexão de dados ----------------------------- */

function ConnectionCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [url, setUrl] = useState(arena.supabase_url ?? "");
  const [anon, setAnon] = useState(arena.supabase_anon_key ?? "");
  const [serviceKey, setServiceKey] = useState("");
  const [bucket, setBucket] = useState(arena.videos_bucket ?? "replays");
  const [retention, setRetention] = useState<string>(arena.retention_days?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUrl(arena.supabase_url ?? "");
    setAnon(arena.supabase_anon_key ?? "");
    setServiceKey("");
    setBucket(arena.videos_bucket ?? "replays");
    setRetention(arena.retention_days?.toString() ?? "");
  }, [arena.id]);

  async function save() {
    setBusy(true);
    try {
      const { updateArenaConnection } = await import("@/lib/arena-admin.functions");
      const days = retention.trim() ? parseInt(retention, 10) : null;
      await updateArenaConnection({
        data: {
          arenaId: arena.id,
          supabase_url: url.trim() || null,
          supabase_anon_key: anon.trim() || null,
          supabase_service_key: serviceKey.trim() || undefined,
          videos_bucket: bucket.trim() || null,
          retention_days: days,
        },
      });
      toast.success("Conexão salva");
      setServiceKey("");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Conexão com Supabase da arena</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Cada arena pode ter o próprio projeto Supabase com bucket de vídeos. A <strong>service key</strong>
        é usada apenas no servidor (limpeza por retenção) e nunca é exposta ao navegador.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Supabase URL</Label>
          <Input placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <Label>Anon key</Label>
          <Input placeholder="eyJhbGciOi..." value={anon} onChange={(e) => setAnon(e.target.value)} />
        </div>
        <div>
          <Label>Service key (somente servidor)</Label>
          <Input
            type="password"
            placeholder={arena.supabase_url ? "•••••• (deixe em branco para manter)" : "eyJhbGciOi..."}
            value={serviceKey}
            onChange={(e) => setServiceKey(e.target.value)}
          />
        </div>
        <div>
          <Label>Bucket de vídeos</Label>
          <Input placeholder="replays" value={bucket} onChange={(e) => setBucket(e.target.value)} />
        </div>
        <div>
          <Label>Dias de retenção (opcional, sobrescreve global)</Label>
          <Input
            type="number"
            min={1}
            max={3650}
            placeholder="ex: 30"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar conexão"}</Button>
      </div>
    </Card>
  );
}
