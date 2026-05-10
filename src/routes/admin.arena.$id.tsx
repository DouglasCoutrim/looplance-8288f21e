import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/arena/$id")({ component: ArenaDetailPage });

interface Arena {
  id: string;
  name: string;
  slug: string;
  supabase_url: string | null;
  supabase_service_key: string | null;
}
interface BtnRow { id: string; label: string }
interface CamRow { id: string; name: string; rtsp_url: string; button_id: string | null }
interface BoardRow { id: string; name: string; serial: string }
interface UserRow { user_id: string; role: string; full_name: string | null }

function ArenaDetailPage() {
  const { id } = Route.useParams();
  const { user, loading, isSuperAdmin } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [buttons, setButtons] = useState<BtnRow[]>([]);
  const [cameras, setCameras] = useState<CamRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  async function load() {
    const { data: a } = await supabase.from("arenas").select("id,name,slug,supabase_url,supabase_service_key").eq("id", id).maybeSingle();
    setArena(a as Arena | null);
    const [{ data: b }, { data: c }, { data: bo }, { data: ur }] = await Promise.all([
      supabase.from("arena_buttons").select("id,label").eq("arena_id", id).order("label"),
      supabase.from("cameras").select("id,name,rtsp_url,button_id").eq("arena_id", id).order("name"),
      supabase.from("zero_delay_boards").select("id,name,serial").eq("arena_id", id).order("name"),
      supabase.from("user_roles").select("user_id,role").eq("arena_id", id),
    ]);
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
  }

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin, id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/acesso-negado" />;
  if (!arena) return <AppShell><p className="text-muted-foreground">Carregando arena...</p></AppShell>;

  const usedBtnIds = new Set(cameras.map((c) => c.button_id).filter(Boolean) as string[]);
  const availableButtons = buttons.filter((b) => !usedBtnIds.has(b.id));

  return (
    <AppShell title={`Arena · ${arena.name}`}>
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
        <div>
          <h1 className="text-2xl font-bold">{arena.name}</h1>
          <p className="text-sm text-muted-foreground">/{arena.slug}</p>
        </div>
      </div>

      <Tabs defaultValue="conexao" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="cameras">Câmeras</TabsTrigger>
          <TabsTrigger value="placas">Placas Zero Delay</TabsTrigger>
          <TabsTrigger value="botoes">Botões</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <ConnectionCard arena={arena} onSaved={load} />
        </TabsContent>

        <TabsContent value="botoes">
          <ButtonsCard arenaId={id} buttons={buttons} usedIds={usedBtnIds} onChange={load} />
        </TabsContent>

        <TabsContent value="cameras">
          <CamerasCard arenaId={id} cameras={cameras} buttons={buttons} availableButtons={availableButtons} onChange={load} />
        </TabsContent>

        <TabsContent value="placas">
          <BoardsCard arenaId={id} boards={boards} onChange={load} />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersCard users={users} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ConnectionCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [url, setUrl] = useState(arena.supabase_url ?? "");
  const [key, setKey] = useState(arena.supabase_service_key ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Configuração de conexão</h2>
      <p className="mb-4 text-sm text-muted-foreground">Credenciais Supabase específicas desta unidade. Visíveis apenas para o SuperAdmin.</p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const { error } = await supabase.from("arenas").update({ supabase_url: url || null, supabase_service_key: key || null }).eq("id", arena.id);
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Conexão atualizada");
          onSaved();
        }}
      >
        <div>
          <Label>SUPABASE_URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxx.supabase.co" />
        </div>
        <div>
          <Label>SUPABASE_SERVICE_KEY</Label>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." />
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar conexão"}</Button>
      </form>
    </Card>
  );
}

function ButtonsCard({ arenaId, buttons, usedIds, onChange }: { arenaId: string; buttons: BtnRow[]; usedIds: Set<string>; onChange: () => void }) {
  const [label, setLabel] = useState("");
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Botões disponíveis</h2>
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
            <div className="flex items-center gap-3">
              <span className="font-medium">{b.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${usedIds.has(b.id) ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"}`}>
                {usedIds.has(b.id) ? "Em uso" : "Disponível"}
              </span>
            </div>
            <Button
              size="icon" variant="ghost"
              onClick={async () => {
                if (!confirm("Remover este botão?")) return;
                const { error } = await supabase.from("arena_buttons").delete().eq("id", b.id);
                if (error) return toast.error(error.message);
                onChange();
              }}
            ><Trash2 className="h-4 w-4" /></Button>
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
  const labelOf = (id: string | null) => buttons.find((b) => b.id === id)?.label ?? "—";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Câmeras cadastradas</h2>
        <div className="space-y-2">
          {cameras.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.rtsp_url}</p>
                  <p className="mt-1 text-xs">Botão: <span className="text-primary">{labelOf(c.button_id)}</span></p>
                </div>
                <div className="flex gap-2">
                  <CameraButtonChange camera={c} buttons={buttons} availableButtons={availableButtons} onChange={onChange} />
                  <Button
                    size="icon" variant="ghost"
                    onClick={async () => {
                      if (!confirm("Remover câmera?")) return;
                      const { error } = await supabase.from("cameras").delete().eq("id", c.id);
                      if (error) return toast.error(error.message);
                      onChange();
                    }}
                  ><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
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

function BoardsCard({ arenaId, boards, onChange }: { arenaId: string; boards: BoardRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Placas Zero Delay</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Nome</th><th className="p-3">Serial</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {boards.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3 text-muted-foreground">{b.serial}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm("Remover placa?")) return;
                      const { error } = await supabase.from("zero_delay_boards").delete().eq("id", b.id);
                      if (error) return toast.error(error.message);
                      onChange();
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {boards.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhuma placa cadastrada</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Nova placa</h2>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("zero_delay_boards").insert({ arena_id: arenaId, name, serial });
          if (error) return toast.error(error.message);
          setName(""); setSerial(""); onChange();
        }}>
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><Label>ID / Serial</Label><Input value={serial} onChange={(e) => setSerial(e.target.value)} required /></div>
          <Button type="submit" className="w-full">Cadastrar placa</Button>
        </form>
      </Card>
    </div>
  );
}

function UsersCard({ users }: { users: UserRow[] }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Usuários da arena</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Nome</th><th className="p-3">Papel</th><th className="p-3">User ID</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={`${u.user_id}-${u.role}`} className="border-t border-border">
                <td className="p-3 font-medium">{u.full_name ?? "—"}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "admin_arena" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {u.role === "admin_arena" ? "Admin" : "Jogador"}
                  </span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{u.user_id}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum usuário vinculado</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
