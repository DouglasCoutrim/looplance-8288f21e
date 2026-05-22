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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Camera, Download, Loader2, Trash2, Upload } from "lucide-react";
import { VideoActions } from "@/components/VideoActions";

export const Route = createFileRoute("/painel")({ component: ArenaPanel });

interface Arena { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; city: string | null; state: string | null; }
interface Court { id: string; name: string; qr_token: string; }
interface Video { id: string; video_url: string; quadra_id: string | null; created_at: string; }
interface CameraRow { id: string; name: string; }
interface CourtCameraRow { id: string; court_id: string; camera_id: string; }

function ArenaPanel() {
  const { user, loading, adminArenaId } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [cameras, setCameras] = useState<CameraRow[]>([]);
  const [courtCameras, setCourtCameras] = useState<CourtCameraRow[]>([]);
  const [newCourt, setNewCourt] = useState("");
  const [arenaName, setArenaName] = useState("");
  const [arenaCity, setArenaCity] = useState("");
  const [arenaState, setArenaState] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCourtId, setVideoCourtId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!adminArenaId) return;
    const [{ data: a }, { data: c }, { data: v }, { data: cams }, { data: cc }] = await Promise.all([
      supabase.from("arenas").select("*").eq("id", adminArenaId).maybeSingle(),
      supabase.from("courts").select("*").eq("arena_id", adminArenaId).order("name"),
      supabase.from("replays").select("*").eq("arena_id", adminArenaId).order("created_at", { ascending: false }),
      supabase.from("cameras").select("id,name").eq("arena_id", adminArenaId).order("name"),
      supabase.from("court_cameras").select("id,court_id,camera_id").eq("arena_id", adminArenaId),
    ]);
    if (a) { setArena(a as Arena); setArenaName(a.name); setArenaCity((a as Arena).city ?? ""); setArenaState((a as Arena).state ?? ""); }
    setCourts((c ?? []) as Court[]);
    setVideos((v ?? []) as Video[]);
    setCameras((cams ?? []) as CameraRow[]);
    setCourtCameras((cc ?? []) as CourtCameraRow[]);
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
    const { error } = await supabase.from("courts").insert({ arena_id: arena.id, name: newCourt });
    if (error) return toast.error(error.message);
    setNewCourt(""); load();
  }

  async function removeCourt(id: string) {
    if (!confirm("Excluir esta quadra?")) return;
    await supabase.from("courts").delete().eq("id", id);
    load();
  }

  async function toggleCourtCamera(courtId: string, cameraId: string, on: boolean) {
    if (!arena) return;
    if (on) {
      const { error } = await supabase
        .from("court_cameras")
        .insert({ court_id: courtId, camera_id: cameraId, arena_id: arena.id });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("court_cameras")
        .delete()
        .eq("court_id", courtId)
        .eq("camera_id", cameraId);
      if (error) return toast.error(error.message);
    }
    load();
  }

  async function uploadVideo(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !arena) return toast.error("Selecione um vídeo");
    setUploading(true);
    const path = `${arena.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("arena-videos").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("arena-videos").getPublicUrl(path);
    const { error } = await supabase.from("replays").insert({
      arena_id: arena.id,
      quadra_id: videoCourtId || null,
      video_url: pub.publicUrl,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Vídeo publicado!");
    setVideoCourtId("");
    if (fileRef.current) fileRef.current.value = "";
    load();
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
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
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
              Cadastre as quadras da sua arena e vincule as câmeras já registradas pelo super
              admin para esta arena.
            </p>
            <form onSubmit={addCourt} className="flex gap-2">
              <Input value={newCourt} onChange={(e) => setNewCourt(e.target.value)} placeholder="Nome da quadra" required />
              <Button type="submit">Adicionar</Button>
            </form>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courts.map((c) => {
              const linkedIds = new Set(courtCameras.filter((cc) => cc.court_id === c.id).map((cc) => cc.camera_id));
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

                  <div className="mt-4 border-t border-border pt-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" /> Câmeras vinculadas
                    </div>
                    {cameras.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma câmera disponível. Peça ao super admin para cadastrar câmeras nesta arena.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {cameras.map((cam) => {
                          const checked = linkedIds.has(cam.id);
                          return (
                            <label key={cam.id} className="flex cursor-pointer items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleCourtCamera(c.id, cam.id, Boolean(v))}
                              />
                              <span>{cam.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {courts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Publicar vídeo</h2>
            <form onSubmit={uploadVideo} className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Quadra</Label>
                <select
                  value={videoCourtId}
                  onChange={(e) => setVideoCourtId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— sem quadra —</option>
                  {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Arquivo</Label>
                <Input ref={fileRef} type="file" accept="video/*" required />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={uploading} className="w-full">
                  {uploading ? "Enviando..." : <><Upload className="mr-2 h-4 w-4" />Publicar</>}
                </Button>
              </div>
            </form>
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Vídeos publicados</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {videos.map((v) => (
                <div key={v.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <video src={v.video_url} controls className="aspect-video w-full rounded-md bg-black" />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </p>
                    <Button size="icon" variant="ghost" onClick={() => deleteVideo(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <VideoActions url={v.video_url} title="Replay" className="mt-2" />
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
