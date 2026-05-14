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
import { Download, Loader2, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/arena")({ component: ArenaPanel });

interface Arena { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; }
interface Court { id: string; name: string; qr_token: string; }
interface Video { id: string; title: string; video_url: string; court_id: string | null; created_at: string; }

function ArenaPanel() {
  const { user, loading, adminArenaId } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [newCourt, setNewCourt] = useState("");
  const [arenaName, setArenaName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCourtId, setVideoCourtId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!adminArenaId) return;
    const [{ data: a }, { data: c }, { data: v }] = await Promise.all([
      supabase.from("arenas").select("*").eq("id", adminArenaId).maybeSingle(),
      supabase.from("courts").select("*").eq("arena_id", adminArenaId).order("name"),
      supabase.from("videos").select("*").eq("arena_id", adminArenaId).order("created_at", { ascending: false }),
    ]);
    if (a) { setArena(a as Arena); setArenaName(a.name); }
    setCourts((c ?? []) as Court[]);
    setVideos((v ?? []) as Video[]);
  }
  useEffect(() => { load(); }, [adminArenaId]);

  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" />;
  if (!adminArenaId) return <Navigate to="/" />;

  async function saveArenaName() {
    if (!arena) return;
    const { error } = await supabase.from("arenas").update({ name: arenaName }).eq("id", arena.id);
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

  async function uploadVideo(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !arena || !videoTitle) return toast.error("Preencha título e selecione um vídeo");
    setUploading(true);
    const path = `${arena.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("arena-videos").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("arena-videos").getPublicUrl(path);
    const { error } = await supabase.from("videos").insert({
      arena_id: arena.id,
      court_id: videoCourtId || null,
      title: videoTitle,
      video_url: pub.publicUrl,
      uploaded_by: user!.id,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Vídeo publicado!");
    setVideoTitle(""); setVideoCourtId("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function deleteVideo(id: string) {
    if (!confirm("Excluir este vídeo?")) return;
    await supabase.from("videos").delete().eq("id", id);
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
            <form onSubmit={addCourt} className="flex gap-2">
              <Input value={newCourt} onChange={(e) => setNewCourt(e.target.value)} placeholder="Nome da quadra" required />
              <Button type="submit">Adicionar</Button>
            </form>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courts.map((c) => (
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
              </Card>
            ))}
            {courts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-4 space-y-4">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Publicar vídeo</h2>
            <form onSubmit={uploadVideo} className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Título</Label>
                <Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} required />
              </div>
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
                  <div className="mt-2 flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <Button size="icon" variant="ghost" onClick={() => deleteVideo(v.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
