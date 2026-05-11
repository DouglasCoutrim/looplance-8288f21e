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
import { ArrowLeft, Check, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/admin/arena/$id")({ component: ArenaDetailPage });

interface Arena {
  id: string;
  name: string;
  slug: string;
  supabase_url: string | null;
  supabase_service_key: string | null;
  logo_url: string | null;
  primary_color: string;
}
interface BtnRow {
  id: string; label: string;
  board_id: string | null; button_number: number | null;
  hardware_pin: string | null; camera_id: string | null;
}
interface CamRow { id: string; name: string; rtsp_url: string; button_id: string | null }
interface BoardRow { id: string; name: string; serial: string; model: string }
interface UserRow { user_id: string; role: string; full_name: string | null }

function ArenaDetailPage() {
  const { id } = Route.useParams();
  const { user, loading, isSuperAdmin } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [buttons, setButtons] = useState<BtnRow[]>([]);
  const [cameras, setCameras] = useState<CamRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setPageLoading(true);
    setLoadError(null);
    const { data: a, error: arenaError } = await supabase
      .from("arenas")
      .select("id,name,slug,supabase_url,supabase_service_key,logo_url,primary_color")
      .eq("id", id).maybeSingle();
    if (arenaError) {
      setLoadError(arenaError.message);
      setPageLoading(false);
      return;
    }
    setArena(a as Arena | null);
    const [{ data: b, error: bErr }, { data: c, error: cErr }, { data: bo, error: boErr }, { data: ur, error: urErr }] = await Promise.all([
      supabase.from("arena_buttons").select("id,label,board_id,button_number,hardware_pin,camera_id").eq("arena_id", id).order("button_number", { ascending: true }),
      supabase.from("cameras").select("id,name,rtsp_url,button_id").eq("arena_id", id).order("name"),
      supabase.from("zero_delay_boards").select("id,name,serial,model").eq("arena_id", id).order("name"),
      supabase.from("user_roles").select("user_id,role").eq("arena_id", id),
    ]);
    const firstError = bErr ?? cErr ?? boErr ?? urErr;
    if (firstError) setLoadError(firstError.message);
    setButtons((b ?? []) as BtnRow[]);
    setCameras((c ?? []) as CamRow[]);
    setBoards((bo ?? []) as BoardRow[]);
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

  const usedBtnIds = new Set(cameras.map((c) => c.button_id).filter(Boolean) as string[]);
  const availableButtons = buttons.filter((b) => !usedBtnIds.has(b.id));

  return (
    <AppShell title={`Arena · ${arena.name}`}>
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
        <div className="flex items-center gap-3">
          {arena.logo_url && <img src={arena.logo_url} alt="" className="h-10 w-10 rounded object-contain bg-muted" />}
          <div>
            <h1 className="text-2xl font-bold">{arena.name}</h1>
            <p className="text-sm text-muted-foreground">/{arena.slug}</p>
          </div>
        </div>
      </div>

      {loadError && (
        <Card className="mb-4 border-destructive/50 p-4 text-sm text-destructive">
          Erro ao carregar parte da configuração: {loadError}
        </Card>
      )}

      <Tabs defaultValue="infra" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="infra">Infra</TabsTrigger>
          <TabsTrigger value="cameras">Câmeras</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="whitelabel">White Label</TabsTrigger>
        </TabsList>

        <TabsContent value="infra" className="space-y-6">
          <ConnectionCard arena={arena} onSaved={load} />
          <LocalServerCard arena={arena} buttons={buttons} cameras={cameras} />
          <BoardsCard arenaId={id} boards={boards} buttons={buttons} cameras={cameras} onChange={load} />
          <ButtonsCard arenaId={id} buttons={buttons.filter((b) => !b.board_id)} usedIds={usedBtnIds} onChange={load} />
        </TabsContent>

        <TabsContent value="cameras">
          <CamerasCard arenaId={id} cameras={cameras} buttons={buttons} availableButtons={availableButtons} onChange={load} />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersCard arenaId={id} users={users} onChange={load} />
        </TabsContent>

        <TabsContent value="whitelabel">
          <WhiteLabelCard arena={arena} onSaved={load} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ConnectionCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [url, setUrl] = useState(arena.supabase_url ?? "");
  const [key, setKey] = useState(arena.supabase_service_key ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(arena.supabase_url ?? ""); setKey(arena.supabase_service_key ?? ""); }, [arena.id]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("arenas").update({ supabase_url: url || null, supabase_service_key: key || null }).eq("id", arena.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conexão atualizada");
    setEdit(false); onSaved();
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Configuração de conexão</h2>
          <p className="text-sm text-muted-foreground">Credenciais Supabase específicas desta unidade.</p>
        </div>
        {!edit && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>}
      </div>
      <div className="space-y-4">
        <div>
          <Label>SUPABASE_URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} disabled={!edit} placeholder="https://xxx.supabase.co" />
        </div>
        <div>
          <Label>SUPABASE_SERVICE_KEY</Label>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} disabled={!edit} placeholder="eyJhbGciOi..." />
        </div>
        {edit && (
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            <Button variant="ghost" onClick={() => { setEdit(false); setUrl(arena.supabase_url ?? ""); setKey(arena.supabase_service_key ?? ""); }}>Cancelar</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ButtonsCard({ arenaId, buttons, usedIds, onChange }: { arenaId: string; buttons: BtnRow[]; usedIds: Set<string>; onChange: () => void }) {
  const [label, setLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Botões da arena</h2>
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;
          const { error } = await supabase.from("arena_buttons").insert({ arena_id: arenaId, label: label.trim() });
          if (error) return toast.error(error.message);
          setLabel(""); onChange();
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Botão Quadra 1" />
        <Button type="submit">Adicionar</Button>
      </form>
      <ul className="space-y-2">
        {buttons.map((b) => (
          <li key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-1 items-center gap-3">
              {editId === b.id ? (
                <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="max-w-xs" />
              ) : (
                <span className="font-medium">{b.label}</span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs ${usedIds.has(b.id) ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"}`}>
                {usedIds.has(b.id) ? "Em uso" : "Disponível"}
              </span>
            </div>
            <div className="flex gap-1">
              {editId === b.id ? (
                <>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    const { error } = await supabase.from("arena_buttons").update({ label: editLabel.trim() }).eq("id", b.id);
                    if (error) return toast.error(error.message);
                    setEditId(null); onChange();
                  }}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => { setEditId(b.id); setEditLabel(b.label); }}><Pencil className="h-4 w-4" /></Button>
              )}
              <Button size="icon" variant="ghost" onClick={async () => {
                if (!confirm("Remover este botão?")) return;
                const { error } = await supabase.from("arena_buttons").delete().eq("id", b.id);
                if (error) return toast.error(error.message);
                onChange();
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        ))}
        {buttons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum botão cadastrado.</p>}
      </ul>
    </Card>
  );
}

function CamerasCard({ arenaId, cameras, buttons, availableButtons, onChange }:
  { arenaId: string; cameras: CamRow[]; buttons: BtnRow[]; availableButtons: BtnRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [rtsp, setRtsp] = useState("");
  const [btnId, setBtnId] = useState<string>("none");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eRtsp, setERtsp] = useState("");
  const labelOf = (id: string | null) => buttons.find((b) => b.id === id)?.label ?? "—";

  function startEdit(c: CamRow) { setEditId(c.id); setEName(c.name); setERtsp(c.rtsp_url); }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Câmeras cadastradas</h2>
        <div className="space-y-2">
          {cameras.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              {editId === c.id ? (
                <div className="space-y-2">
                  <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Nome" />
                  <Input value={eRtsp} onChange={(e) => setERtsp(e.target.value)} placeholder="rtsp://..." />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      const { error } = await supabase.from("cameras").update({ name: eName, rtsp_url: eRtsp }).eq("id", c.id);
                      if (error) return toast.error(error.message);
                      setEditId(null); onChange();
                    }}><Check className="mr-1 h-4 w-4" />Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.rtsp_url}</p>
                    <p className="mt-1 text-xs">Botão: <span className="text-primary">{labelOf(c.button_id)}</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CameraButtonChange camera={c} buttons={buttons} availableButtons={availableButtons} onChange={onChange} />
                    <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm("Remover câmera?")) return;
                      const { error } = await supabase.from("cameras").delete().eq("id", c.id);
                      if (error) return toast.error(error.message);
                      onChange();
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {cameras.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma câmera cadastrada.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Nova câmera</h2>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const payload: any = { arena_id: arenaId, name, rtsp_url: rtsp };
            if (btnId !== "none") payload.button_id = btnId;
            const { error } = await supabase.from("cameras").insert(payload);
            if (error) return toast.error(error.message);
            setName(""); setRtsp(""); setBtnId("none"); onChange();
          }}
        >
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>URL RTSP</Label><Input value={rtsp} onChange={(e) => setRtsp(e.target.value)} placeholder="rtsp://..." required /></div>
          <div>
            <Label>Botão associado</Label>
            <Select value={btnId} onValueChange={setBtnId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem botão</SelectItem>
                {availableButtons.map((b) => (<SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Botões já vinculados a outra câmera não aparecem.</p>
          </div>
          <Button type="submit" className="w-full">Cadastrar câmera</Button>
        </form>
      </Card>
    </div>
  );
}

function CameraButtonChange({ camera, buttons, availableButtons, onChange }:
  { camera: CamRow; buttons: BtnRow[]; availableButtons: BtnRow[]; onChange: () => void }) {
  const current = buttons.find((b) => b.id === camera.button_id);
  const options = current ? [current, ...availableButtons.filter((b) => b.id !== current.id)] : availableButtons;
  return (
    <Select
      value={camera.button_id ?? "none"}
      onValueChange={async (v) => {
        const next = v === "none" ? null : v;
        const { error } = await supabase.from("cameras").update({ button_id: next }).eq("id", camera.id);
        if (error) return toast.error(error.message);
        onChange();
      }}
    >
      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem botão</SelectItem>
        {options.map((b) => (<SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}

function BoardsCard({ arenaId, boards, buttons, cameras, onChange }: { arenaId: string; boards: BoardRow[]; buttons: BtnRow[]; cameras: CamRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eSerial, setESerial] = useState("");
  const cameraName = (id: string | null) => cameras.find((c) => c.id === id)?.name ?? "—";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Placas Zero Delay (ARC-968)</h2>
          <p className="text-sm text-muted-foreground">Cada placa cadastrada gera automaticamente os 12 botões físicos (K1–K12).</p>
        </div>
      </div>
      <form className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.from("zero_delay_boards").insert({ arena_id: arenaId, name, serial });
        if (error) return toast.error(error.message);
        setName(""); setSerial(""); onChange();
      }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da placa" required />
        <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="ID / Serial" required />
        <Button type="submit">Adicionar placa</Button>
      </form>

      <div className="space-y-4">
        {boards.map((b) => {
          const boardButtons = buttons.filter((btn) => btn.board_id === b.id)
            .sort((a, c) => (a.button_number ?? 0) - (c.button_number ?? 0));
          return (
            <div key={b.id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                {editId === b.id ? (
                  <div className="flex flex-1 gap-2">
                    <Input value={eName} onChange={(e) => setEName(e.target.value)} />
                    <Input value={eSerial} onChange={(e) => setESerial(e.target.value)} />
                    <Button size="icon" variant="ghost" onClick={async () => {
                      const { error } = await supabase.from("zero_delay_boards").update({ name: eName, serial: eSerial }).eq("id", b.id);
                      if (error) return toast.error(error.message);
                      setEditId(null); onChange();
                    }}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold">{b.name} <span className="text-xs text-muted-foreground">· {b.model ?? "ARC-968"}</span></p>
                      <p className="text-xs text-muted-foreground">Serial: {b.serial}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(b.id); setEName(b.name); setESerial(b.serial); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm("Remover placa? Os 12 botões dela também serão excluídos.")) return;
                        const { error } = await supabase.from("zero_delay_boards").delete().eq("id", b.id);
                        if (error) return toast.error(error.message);
                        onChange();
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {boardButtons.map((btn) => {
                  const occupied = !!btn.camera_id;
                  return (
                    <div key={btn.id} className={`rounded-md border p-2 text-xs ${occupied ? "border-orange-500/40 bg-orange-500/10" : "border-primary/40 bg-primary/10"}`}>
                      <p className="font-semibold">{btn.label}</p>
                      <p className="mt-1">
                        {occupied
                          ? <span className="text-orange-600 dark:text-orange-400">Em uso → {cameraName(btn.camera_id)}</span>
                          : <span className="text-primary">Livre</span>}
                      </p>
                    </div>
                  );
                })}
                {boardButtons.length === 0 && (
                  <p className="col-span-full text-xs text-muted-foreground">Nenhum botão gerado.</p>
                )}
              </div>
            </div>
          );
        })}
        {boards.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma placa cadastrada.</p>}
      </div>
    </Card>
  );
}

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

function WhiteLabelCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [color, setColor] = useState(arena.primary_color);
  const [name, setName] = useState(arena.name);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setColor(arena.primary_color); setName(arena.name); }, [arena.id]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("arenas").update({ primary_color: color, name }).eq("id", arena.id);
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
      <p className="mb-4 text-sm text-muted-foreground">Identidade visual exibida ao cliente final.</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label>Nome da arena</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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
