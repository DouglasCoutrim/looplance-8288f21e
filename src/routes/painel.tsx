import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, Loader2, PlaySquare, Trash2, Upload, Wifi, ImagePlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoActions } from "@/components/VideoActions";

export const Route = createFileRoute("/painel")({ component: ArenaPanel });

interface Arena { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; city: string | null; state: string | null; }
interface Court { id: string; name: string; qr_token: string; cameras?: { id: string; name: string; rtsp_url: string }[]; }
interface Video { id: string; title: string; video_url: string; court_id: string | null; created_at: string; }

function ArenaPanel() {
  const { user, loading, adminArenaId } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [newCourt, setNewCourt] = useState("");
  const [arenaName, setArenaName] = useState("");
  const [arenaCity, setArenaCity] = useState("");
  const [arenaState, setArenaState] = useState("");
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!adminArenaId) return;
    const [{ data: a }, { data: q }, { data: v }, { data: cams }] = await Promise.all([
      supabase.from("arenas").select("*").eq("id", adminArenaId).maybeSingle(),
      supabase.from("quadras").select("id, arena_id, nome").eq("arena_id", adminArenaId).order("nome").then((res: any) => res, () => ({ data: [] })),
      supabase.from("replays").select("*").eq("arena_id", adminArenaId).order("created_at", { ascending: false }).then((res: any) => res, () => ({ data: [] })),
      supabase.from("cameras").select("id, quadra_id, name, rtsp_url").eq("arena_id", adminArenaId).then((res: any) => res, () => ({ data: [] })),
    ]);
    if (a) { setArena(a as Arena); setArenaName(a.name); setArenaCity((a as Arena).city ?? ""); setArenaState((a as Arena).state ?? ""); }
    
    const courtCamsMap = new Map<string, { id: string; name: string; rtsp_url: string }[]>();
    (cams ?? []).forEach((cam: any) => {
        const list = courtCamsMap.get(cam.quadra_id) ?? [];
        list.push({
          id: cam.id,
          name: cam.name,
          rtsp_url: cam.rtsp_url
        });
        courtCamsMap.set(cam.quadra_id, list);
    });
    
    const mappedCourts = (q ?? []).map((row: any) => ({
      id: row.id,
      name: row.nome,
      qr_token: row.id,
      cameras: courtCamsMap.get(row.id) ?? []
    }));
    setCourts(mappedCourts as Court[]);
    
    const mappedVideos = (v ?? []).map((row: any) => ({
      id: row.id,
      title: "Replay",
      video_url: row.video_url,
      court_id: row.quadra_id,
      created_at: row.created_at
    }));
    setVideos(mappedVideos as Video[]);
  }
  
  useEffect(() => { load(); }, [adminArenaId]);

  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" />;
  if (!adminArenaId) return <Navigate to="/" />;

  async function saveArenaName() {
    if (!arena) return;
    const { error } = await supabase.from("arenas").update({
      name: arenaName,
      city: arenaCity.trim() || null,
      state: arenaState.trim() || null,
    }).eq("id", arena.id);
    if (error) return toast.error(error.message);
    toast.success("Arena atualizada");
    load();
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !arena) return;
    const path = `${arena.id}/logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("arena-logos").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: pub } = supabase.storage.from("arena-logos").getPublicUrl(path);
    await supabase.from("arenas").update({ logo_url: pub.publicUrl }).eq("id", arena.id);
    toast.success("Logo atualizado");
    load();
  }

  async function addCourt(e: React.FormEvent) {
    e.preventDefault();
    if (!arena) return;
    const { error } = await supabase.from("quadras").insert({ arena_id: arena.id, nome: newCourt });
    if (error) {
       toast.error(error.message);
    }
    setNewCourt(""); load();
  }

  async function removeCourt(id: string) {
    if (!confirm("Excluir esta quadra?")) return;
    await supabase.from("quadras").delete().eq("id", id);
    load();
  }



  // triggerReplay obsoleto com nova arquitetura
  async function triggerReplay(courtId: string) {
    toast.info("O sistema agora gera replays automaticamente.");
  }

  async function deleteVideo(id: string) {
    if (!confirm("Excluir este vídeo?")) return;
    await supabase.from("replays").delete().eq("id", id);
    load();
  }

  function downloadQR(courtId: string) {
    const canvas = document.getElementById(`qr-${courtId}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `qr-quadra.png`;
    link.click();
  }

  if (!arena) return <FullLoader />;
  const playerUrl = (token: string) => `${window.location.origin}/arena/${arena.id}?q=${token}`;

  return (
    <AppShell title={`Painel · ${arena.name}`}>
      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config">Arena</TabsTrigger>
          <TabsTrigger value="courts">Quadras & QR</TabsTrigger>
          <TabsTrigger value="cameras">Câmeras</TabsTrigger>
          <TabsTrigger value="boards">Placas Zero Delay</TabsTrigger>
          <TabsTrigger value="videos">Vídeos Replays</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">White Label</h2>
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                  {arena.logo_url
                    ? <img src={arena.logo_url} alt="" className="max-h-32" />
                    : <span className="text-xs text-muted-foreground">Sem logo</span>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={uploadLogo} />
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => logoRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Enviar logo
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Nome da arena</Label>
                  <Input value={arenaName} onChange={(e) => setArenaName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={arenaCity} onChange={(e) => setArenaCity(e.target.value)} placeholder="Ex.: Cristalina" />
                  </div>
                  <div>
                    <Label>Estado (UF)</Label>
                    <Input value={arenaState} onChange={(e) => setArenaState(e.target.value)} placeholder="Ex.: GO" maxLength={2} />
                  </div>
                </div>
                <div>
                  <Label>Slug (URL pública)</Label>
                  <Input value={arena.slug} disabled />
                </div>
                <Button onClick={saveArenaName}>Salvar</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="courts" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">Minhas Quadras</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Cadastre as quadras da sua arena e defina o link RTSP das câmeras.
            </p>
            <form onSubmit={addCourt} className="flex gap-2">
              <Input value={newCourt} onChange={(e) => setNewCourt(e.target.value)} placeholder="Nome da quadra" required />
              <Button type="submit">Adicionar</Button>
            </form>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courts.map((c) => {
              return (
                <Card key={c.id} className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Button size="icon" variant="ghost" onClick={() => removeCourt(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-center rounded-lg bg-white p-3">
                    <QRCodeCanvas id={`qr-${c.id}`} value={playerUrl(c.qr_token)} size={160} />
                  </div>
                  <p className="mt-2 break-all text-center text-[10px] text-muted-foreground">{playerUrl(c.qr_token)}</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => downloadQR(c.id)}>
                    <Download className="mr-2 h-4 w-4" /> Baixar QR
                  </Button>

                  <div className="mt-4 border-t border-border pt-3 space-y-3">
                    <div>
                      <Label className="text-xs font-semibold">Câmeras Vinculadas</Label>
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        {c.cameras && c.cameras.length > 0 ? (
                          c.cameras.map((cam) => (
                            <span key={cam.id} className="text-xs bg-muted border border-border px-2 py-1.5 rounded-md flex flex-col gap-0.5">
                              <span className="font-semibold text-card-foreground">{cam.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono truncate">{cam.rtsp_url}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhuma câmera vinculada. Peça ao administrador para configurar na aba "Câmeras".</span>
                        )}
                      </div>
                    </div>

                    <Button variant="default" size="sm" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => triggerReplay(c.id)}>
                      <PlaySquare className="mr-2 h-4 w-4" /> Disparar Replay Teste
                    </Button>
                  </div>
                </Card>
              );
            })}
            {courts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="cameras" className="mt-4 space-y-4">
          <CamerasCard arenaId={adminArenaId} />
        </TabsContent>

        <TabsContent value="boards" className="mt-4 space-y-4">
          <BoardsCard arenaId={adminArenaId} />
        </TabsContent>

        <TabsContent value="videos" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Vídeos publicados na Arena</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {videos.map((v) => (
                <div key={v.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <video src={v.video_url} controls className="aspect-video w-full rounded-md bg-black" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <Button size="icon" variant="ghost" onClick={() => deleteVideo(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <VideoActions url={v.video_url} title={v.title} className="mt-2" />
                </div>
              ))}
              {videos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vídeo publicado.</p>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* -------------------------- Componentes de Gestão -------------------------- */

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

  useEffect(() => { load(); }, [arenaId]);

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
    toast.success("Placa Zero-Delay cadastrada! 12 botões gerados.");
    load();
  }

  async function remove(board: ZeroDelayBoard) {
    if (!confirm(`Remover placa "${board.nome}"?`)) return;
    const { error } = await supabase.from("placas_zero_delay").delete().eq("id", board.id);
    if (error) return toast.error(error.message);
    toast.success("Placa removida");
    load();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Placas Zero-Delay</h2>
      <p className="mb-4 text-sm text-muted-foreground">Cadastre as placas de controle físico de botões.</p>
      <form onSubmit={add} className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] items-end border border-border/60 rounded-lg p-4 bg-muted/20">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Nome da Placa</Label>
          <Input placeholder="Ex: Placa Quadra 1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Cadastrar"}</Button>
      </form>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma placa cadastrada.</p>
      ) : (
        <div className="space-y-4">
          {list.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-4 bg-card">
              <div>
                <h3 className="font-semibold text-sm">{b.nome}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">12 botões ativos</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface Camera {
  id: string;
  nome: string;
  rtsp_url: string;
  botao_id: string | null;
  quadra_id: string;
  created_at: string;
}

interface ButtonRow {
  id: string;
  label: string;
  board_name?: string;
  status: string;
}

function CamerasCard({ arenaId }: { arenaId: string }) {
  const [list, setList] = useState<(Camera & { button_label?: string; court_name?: string })[]>([]);
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
    }) as (Camera & { button_label: string; court_name: string })[];
    setList(camerasList);
  }

  useEffect(() => { load(); }, [arenaId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome");
    if (!rtspUrl.trim()) return toast.error("Informe a URL RTSP");
    if (selectedCourtId === "none") return toast.error("Selecione uma quadra");
    setBusy(true);
    const { error } = await supabase.from("cameras").insert({
      arena_id: arenaId,
      nome: name.trim(),
      rtsp_url: rtspUrl.trim(),
      botao_id: selectedButtonId === "none" ? null : selectedButtonId,
      quadra_id: selectedCourtId
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Câmera cadastrada!");
    setName(""); setRtspUrl(""); setSelectedButtonId("none"); setSelectedCourtId("none");
    load();
  }

  async function remove(c: Camera) {
    if (!confirm(`Remover câmera "${c.nome}"?`)) return;
    const { error } = await supabase.from("cameras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Câmera removida");
    load();
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Câmeras</h2>
      <form onSubmit={add} className="mb-6 space-y-4 border border-border/60 rounded-lg p-4 bg-muted/20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nome</Label>
            <Input placeholder="Ex: Câmera Lateral" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Botão Físico</Label>
            <Select value={selectedButtonId} onValueChange={setSelectedButtonId}>
              <SelectTrigger><SelectValue placeholder="Selecione um botão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {buttons.filter(b => b.status === 'disponivel' || list.some(c => c.botao_id === b.id)).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.board_name ? `${b.board_name} - ${b.label}` : b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">URL RTSP</Label>
          <Input placeholder="rtsp://..." value={rtspUrl} onChange={(e) => setRtspUrl(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Quadra</Label>
          <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
            <SelectTrigger><SelectValue placeholder="Selecione uma quadra" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Selecione uma quadra</SelectItem>
              {courts.map((court) => (
                <SelectItem key={court.id} value={court.id}>{court.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Adicionar Câmera"}</Button>
      </form>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma câmera cadastrada.</p>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4 bg-card flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">{c.nome}</h3>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">{c.rtsp_url}</p>
                <p className="text-[10px] text-primary">Botão: {c.button_label} · Quadra: {c.court_name}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(c)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function FullLoader() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}
