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
  retention_days: number | null;
}
interface Sponsor { id: string; name: string; logo_url: string; link_url: string | null; display_order: number }
interface CamRow { id: string; name: string; rtsp_url: string; button_id: string | null }
interface UserRow { user_id: string; role: string; full_name: string | null }

function ArenaDetailPage() {
  const { id } = Route.useParams();
  const { user, loading, isSuperAdmin } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setPageLoading(true);
    setLoadError(null);
    const { data: a, error: arenaError } = await supabase
      .from("arenas")
      .select("id,name,slug,logo_url,primary_color,city,state,retention_days")
      .eq("id", id).maybeSingle();
    if (arenaError) {
      setLoadError(arenaError.message);
      setPageLoading(false);
      return;
    }
    setArena(a as Arena | null);
    const { data: ur, error: urErr } = await supabase.from("user_roles").select("user_id,role").eq("arena_id", id);
    if (urErr) setLoadError(urErr.message);
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
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/ingest/$arenaId" params={{ arenaId: arena.id }}>Tokens de ingestão →</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/infra">Gerenciar infra global →</Link>
          </Button>
        </div>
      </div>

      {loadError && (
        <Card className="mb-4 border-destructive/50 p-4 text-sm text-destructive">
          Erro ao carregar parte da configuração: {loadError}
        </Card>
      )}

      <Tabs defaultValue="quadras" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="quadras">Quadras</TabsTrigger>
          <TabsTrigger value="cameras">Câmeras</TabsTrigger>
          <TabsTrigger value="boards">Placas Zero Delay</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="patrocinadores">Patrocinadores</TabsTrigger>
          <TabsTrigger value="whitelabel">White Label</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="quadras">
          <CourtsCard arenaId={id} />
        </TabsContent>

        <TabsContent value="cameras">
          <CamerasCard arenaId={id} />
        </TabsContent>

        <TabsContent value="boards">
          <BoardsCard arenaId={id} />
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

        <TabsContent value="configuracoes" className="space-y-6">
          <ConfiguracoesCard arena={arena} onSaved={load} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* -------------------------------- Quadras -------------------------------- */

interface Court { id: string; name: string; qr_token: string }

function CourtsCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<(Court & { cameras?: { id: string; nome: string; rtsp_url: string }[] })[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: q } = await supabase.from("quadras").select("id,nome").eq("arena_id", arenaId).order("nome");
    
    const { data: cams } = await supabase
      .from("cameras")
      .select("id, nome, rtsp_url, quadra_id")
      .eq("arena_id", arenaId);

    const courtCamsMap = new Map<string, { id: string; nome: string; rtsp_url: string }[]>();
    (cams ?? []).forEach((row: any) => {
        const list = courtCamsMap.get(row.quadra_id) ?? [];
        list.push({
          id: row.id,
          nome: row.nome,
          rtsp_url: row.rtsp_url
        });
        courtCamsMap.set(row.quadra_id, list);
    });

    const mapped = (q ?? []).map((row: any) => ({
      id: row.id,
      name: row.nome,
      qr_token: row.id,
      cameras: courtCamsMap.get(row.id) ?? []
    }));
    setList(mapped);
  }
  useEffect(() => { load(); }, [arenaId]);

  async function notify(reason: "courts.updated") {
    try {
      const { notifyArenaAgent } = await import("@/lib/agent-notify.functions");
      await notifyArenaAgent({ data: { arenaId, reason } });
    } catch {
      /* fire-and-forget */
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome");
    setBusy(true);
    const { error } = await supabase.from("quadras").insert({
      arena_id: arenaId,
      nome: name.trim()
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); toast.success("Quadra criada"); load(); notify("courts.updated");
  }

  async function remove(c: Court) {
    if (!confirm(`Remover quadra "${c.name}"? Isso também remove vídeos.`)) return;
    const { error } = await supabase.from("quadras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    load(); notify("courts.updated");
  }

  async function rename(c: Court, newName: string) {
    const n = newName.trim();
    if (!n || n === c.name) return;
    const { error } = await supabase.from("quadras").update({ nome: n }).eq("id", c.id);
    if (error) return toast.error(error.message);
    load(); notify("courts.updated");
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Quadras desta arena</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Cadastre as quadras da arena. Vincule as câmeras na aba "Câmeras".
      </p>

      <form onSubmit={add} className="mb-6 grid gap-4 md:grid-cols-[4fr_auto] items-end border border-border/60 rounded-lg p-4 bg-muted/20">
        <div className="space-y-1">
          <Label htmlFor="new-court-name" className="text-xs font-semibold">Nome da Quadra</Label>
          <Input id="new-court-name" placeholder="Ex: Quadra 1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Criando..." : "Adicionar"}</Button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada ainda.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            return (
              <div key={c.id} className="grid gap-3 rounded-lg border border-border p-4 hover:border-primary/30 transition-all bg-card">
                <div className="grid gap-3 md:grid-cols-[2fr_3fr_auto] items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground font-medium">Nome da Quadra</Label>
                    <Input
                      defaultValue={c.name}
                      onBlur={(e) => rename(c, e.target.value)}
                      placeholder="Nome da quadra"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground font-medium">Câmeras Vinculadas</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.cameras && c.cameras.length > 0 ? (
                        c.cameras.map((cam) => (
                          <span key={cam.id} className="text-xs bg-muted border border-border px-2 py-1 rounded-md inline-flex items-center gap-1.5">
                            <Wifi className="h-3 w-3 text-emerald-500" />
                            <strong>{cam.nome}</strong>
                            <span className="text-[10px] text-muted-foreground font-mono">({cam.rtsp_url})</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nenhuma câmera vinculada. Vincule na aba "Câmeras".</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => remove(c)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* -------------------------- Placas Zero Delay -------------------------- */

interface ZeroDelayBoard {
  id: string;
  nome: string;
  created_at: string;
}

function BoardsCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<ZeroDelayBoard[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("placas_zero_delay")
      .select("*")
      .eq("arena_id", arenaId)
      .order("created_at", { ascending: false });
    setList((data ?? []) as ZeroDelayBoard[]);
  }

  useEffect(() => {
    load();
  }, [arenaId]);

  async function notify(reason: "courts.updated") {
    try {
      const { notifyArenaAgent } = await import("@/lib/agent-notify.functions");
      await notifyArenaAgent({ data: { arenaId, reason } });
    } catch {
      /* fire-and-forget */
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome da placa");
    setBusy(true);
    const { error } = await supabase.from("placas_zero_delay").insert({
      arena_id: arenaId,
      nome: name.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Placa Zero-Delay cadastrada com sucesso! 12 botões foram gerados.");
    load();
    notify("courts.updated");
  }

  async function remove(board: ZeroDelayBoard) {
    if (!confirm(`Remover placa "${board.nome}"? Isso removerá todos os botões associados.`)) return;
    const { error } = await supabase.from("placas_zero_delay").delete().eq("id", board.id);
    if (error) return toast.error(error.message);
    toast.success("Placa removida");
    load();
    notify("courts.updated");
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Placas Zero-Delay</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Cadastre as placas de controle físico de botões instaladas na arena.
      </p>

      <form onSubmit={add} className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] items-end border border-border/60 rounded-lg p-4 bg-muted/20">
        <div className="space-y-1">
          <Label htmlFor="board-name" className="text-xs font-semibold">Nome da Placa</Label>
          <Input id="board-name" placeholder="Ex: Placa Quadra 1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Salvando..." : "Cadastrar"}
        </Button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma placa cadastrada ainda.</p>
      ) : (
        <div className="space-y-4">
          {list.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary/30 transition-all bg-card">
              <div>
                <h3 className="font-semibold text-sm">{b.nome}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  12 botões gerados automaticamente
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Câmeras ------------------------------ */

interface Camera {
  id: string;
  name: string;
  rtsp_url: string;
  button_id: string | null;
  created_at: string;
}

interface ButtonRow {
  id: string;
  label: string;
  board_name?: string;
}

function CamerasCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<(Camera & { button_label?: string; court_names?: string[]; court_ids?: string[] })[]>([]);
  const [buttons, setButtons] = useState<ButtonRow[]>([]);
  const [courts, setCourts] = useState<{ id: string; name: string }[]>([]);
  
  const [name, setName] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [selectedButtonId, setSelectedButtonId] = useState<string>("none");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: cams } = await supabase.from("cameras").select("*").eq("arena_id", arenaId).order("nome");
    const { data: cts } = await supabase.from("quadras").select("id, nome").eq("arena_id", arenaId).order("nome");
    setCourts((cts ?? []).map((row: any) => ({ id: row.id, name: row.nome })));
    
    const { data: boards } = await supabase.from("placas_zero_delay").select("id, nome").eq("arena_id", arenaId);
    const boardsMap = new Map((boards ?? []).map((b: any) => [b.id, b.nome]));

    const { data: btns } = await supabase.from("botoes_zero_delay").select("id, numero_botao, placa_id, status").in("placa_id", (boards ?? []).map(b => b.id));
    
    const mappedButtons = (btns ?? []).map((b: any) => ({
      id: b.id,
      label: `Botão ${b.numero_botao}${b.status === 'em uso' ? ' (Em Uso)' : ''}`,
      board_name: boardsMap.get(b.placa_id),
      status: b.status
    }));
    setButtons(mappedButtons);

    const buttonsMap = new Map(mappedButtons.map((b) => [b.id, b]));
    const courtsMap = new Map((cts ?? []).map((c: any) => [c.id, c.nome]));

    const camerasList = (cams ?? []).map((c: any) => {
      const btn = c.botao_id ? buttonsMap.get(c.botao_id) : null;
      return {
        ...c,
        button_label: btn ? (btn.board_name ? `${btn.board_name} - ${btn.label}` : btn.label) : "Nenhum",
        court_name: courtsMap.get(c.quadra_id) ?? "Nenhuma"
      };
    });

    setList(camerasList);
  }

  useEffect(() => {
    load();
  }, [arenaId]);

  async function notify(reason: "courts.updated") {
    try {
      const { notifyArenaAgent } = await import("@/lib/agent-notify.functions");
      await notifyArenaAgent({ data: { arenaId, reason } });
    } catch {
      /* fire-and-forget */
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome da câmera");
    if (!rtspUrl.trim()) return toast.error("Informe a URL RTSP");
    if (selectedCourtId === "none") return toast.error("Selecione uma quadra");

    setBusy(true);
    try {
      const { error: camErr } = await supabase
        .from("cameras")
        .insert({
          arena_id: arenaId,
          nome: name.trim(),
          rtsp_url: rtspUrl.trim(),
          botao_id: selectedButtonId === "none" ? null : selectedButtonId,
          quadra_id: selectedCourtId
        });

      if (camErr) throw camErr;

      toast.success("Câmera cadastrada com sucesso!");
      setName("");
      setRtspUrl("");
      setSelectedButtonId("none");
      setSelectedCourtId("none");
      load();
      notify("courts.updated");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar câmera");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Camera) {
    if (!confirm(`Remover câmera "${c.nome}"?`)) return;
    const { error } = await supabase.from("cameras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Câmera removida");
    load();
    notify("courts.updated");
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Cadastro de Câmeras</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Cadastre as câmeras, associe-as aos botões físicos das placas zero-delay e vincule-as às quadras correspondentes.
      </p>

      <form onSubmit={add} className="mb-6 space-y-4 border border-border/60 rounded-lg p-4 bg-muted/20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cam-name" className="text-xs font-semibold">Nome da Câmera</Label>
            <Input id="cam-name" placeholder="Ex: Câmera Lateral Direita" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cam-button" className="text-xs font-semibold">Botão Físico Mapeado</Label>
            <Select value={selectedButtonId} onValueChange={setSelectedButtonId}>
              <SelectTrigger id="cam-button">
                <SelectValue placeholder="Selecione um botão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Somente Gravação / Sem Botão)</SelectItem>
                {buttons.filter(b => b.status === 'disponivel' || list.some(c => c.botao_id === b.id)).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.board_name ? `${b.board_name} - ${b.label}` : b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cam-rtsp" className="text-xs font-semibold flex items-center gap-1">
            <Wifi className="h-3 w-3 text-emerald-500" /> URL RTSP de Ingestão
          </Label>
          <Input id="cam-rtsp" placeholder="rtsp://usuario:senha@ip:porta/stream" value={rtspUrl} onChange={(e) => setRtspUrl(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Vincular a Quadra</Label>
          <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma quadra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione uma quadra</SelectItem>
              {courts.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Adicionar Câmera"}
          </Button>
        </div>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma câmera cadastrada ainda.</p>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <div key={c.id} className="grid gap-3 rounded-lg border border-border p-4 hover:border-primary/30 transition-all bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{c.nome}</h3>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      Botão: {c.button_label}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate max-w-xl bg-muted/40 p-1 rounded">
                    {c.rtsp_url}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-xs text-muted-foreground">Quadra:</span>
                    <span className="text-[10px] border border-border bg-background px-2 py-0.5 rounded">
                      {c.court_name}
                    </span>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(c)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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

function ConfiguracoesCard({ arena, onSaved }: { arena: Arena; onSaved: () => void }) {
  const [retention, setRetention] = useState(arena.retention_days?.toString() || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { updateArenaConnection } = await import("@/lib/arena-admin.functions");
      await updateArenaConnection({
        data: {
          arenaId: arena.id,
          retention_days: retention ? parseInt(retention) : null,
        },
      });
      toast.success("Configurações atualizadas");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Configurações da arena</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Gerencie retenção de dados e outras configurações locais da arena.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
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

      <div className="mt-6">
        <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar configurações"}</Button>
      </div>
    </Card>
  );
}

/* ----------------------------- Tokens do Agente ----------------------------- */

type IngestToken = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function AgentTokensCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<IngestToken[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function load() {
    try {
      const { listArenaIngestTokens } = await import("@/lib/arena-admin.functions");
      const { tokens } = await listArenaIngestTokens({ data: { arenaId } });
      setList(tokens as IngestToken[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar tokens");
    }
  }

  useEffect(() => {
    setNewToken(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaId]);

  async function create() {
    if (!name.trim()) {
      toast.error("Dê um nome ao token (ex: 'Pi quadra 1').");
      return;
    }
    setBusy(true);
    try {
      const { createArenaIngestToken } = await import("@/lib/arena-admin.functions");
      const res = await createArenaIngestToken({ data: { arenaId, name: name.trim() } });
      setNewToken(res.token);
      setName("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar token");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    if (!confirm("Revogar este token? O agente que estiver usando vai parar.")) return;
    try {
      const { revokeArenaIngestToken } = await import("@/lib/arena-admin.functions");
      await revokeArenaIngestToken({ data: { arenaId, tokenId } });
      toast.success("Token revogado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao revogar");
    }
  }

  async function copyToken() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      toast.success("Token copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Tokens do Agente (ingest)</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Use esses tokens no <code>ARENA_INGEST_TOKEN</code> do agente que roda na arena.
        O agente chama <code>GET /api/public/agent/config</code> com{" "}
        <code>Authorization: Bearer &lt;token&gt;</code>. O token é mostrado uma única vez —
        guarde com cuidado.
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="Nome do token (ex: 'Pi principal')"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button onClick={create} disabled={busy}>
          {busy ? "Gerando..." : "Gerar token"}
        </Button>
      </div>

      {newToken && (
        <div className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-semibold">
            Novo token (copie agora — não será mostrado novamente):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">
              {newToken}
            </code>
            <Button size="sm" variant="outline" onClick={copyToken}>
              Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>
              OK
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum token cadastrado ainda.</p>
        )}
        {list.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex-1">
              <div className="font-medium">
                {t.name}{" "}
                {t.revoked_at && (
                  <span className="ml-2 rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    revogado
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <code>{t.token_prefix}…</code> · criado{" "}
                {new Date(t.created_at).toLocaleString("pt-BR")}
                {t.last_used_at && (
                  <> · último uso {new Date(t.last_used_at).toLocaleString("pt-BR")}</>
                )}
              </div>
            </div>
            {!t.revoked_at && (
              <Button size="sm" variant="destructive" onClick={() => revoke(t.id)}>
                Revogar
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
