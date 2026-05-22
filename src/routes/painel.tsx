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
import { Download, Loader2, PlaySquare, Trash2, Upload } from "lucide-react";
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
    const [{ data: a }, { data: q }, { data: v }, { data: mapData }] = await Promise.all([
      supabase.from("arenas").select("*").eq("id", adminArenaId).maybeSingle(),
      supabase.from("quadras").select("id, arena_id, nome").eq("arena_id", adminArenaId).order("nome").then((res: any) => res, () => ({ data: [] })),
      supabase.from("replays").select("*").eq("arena_id", adminArenaId).order("created_at", { ascending: false }).then((res: any) => res, () => ({ data: [] })),
      supabase.from("court_cameras" as any).select("court_id, cameras(id, name, rtsp_url)").eq("arena_id", adminArenaId).then((res: any) => res, () => ({ data: [] })),
    ]);
    if (a) { setArena(a as Arena); setArenaName(a.name); setArenaCity((a as Arena).city ?? ""); setArenaState((a as Arena).state ?? ""); }
    
    const courtCamsMap = new Map<string, { id: string; name: string; rtsp_url: string }[]>();
    (mapData ?? []).forEach((row: any) => {
      if (row.cameras) {
        const cams = courtCamsMap.get(row.court_id) ?? [];
        cams.push({
          id: row.cameras.id,
          name: row.cameras.name,
          rtsp_url: row.cameras.rtsp_url
        });
        courtCamsMap.set(row.court_id, cams);
      }
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



  async function triggerReplay(courtId: string) {
    if (!arena) return;
    const { error } = await supabase.from("arena_buttons").insert({
      arena_id: arena.id,
      quadra_id: courtId,
      status: "disparado"
    });
    if (error) {
      toast.error(`Falha ao disparar: ${error.message}`);
      return;
    }
    toast.success("Sinal de replay enviado ao agente local!");
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

function FullLoader() {
  return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}
