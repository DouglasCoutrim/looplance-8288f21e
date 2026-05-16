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
import { ArrowLeft, Cable, Camera as CameraIcon, Cpu, Loader2, Trash2, Wifi, WifiOff, Clock } from "lucide-react";

async function notifyArena(arenaId: string, reason: "cameras.updated" | "boards.updated" | "buttons.updated") {
  if (!arenaId) return;
  try {
    const { notifyArenaAgent } = await import("@/lib/agent-notify.functions");
    await notifyArenaAgent({ data: { arenaId, reason } });
  } catch {
    /* fire-and-forget */
  }
}

export const Route = createFileRoute("/admin/infra")({ component: GlobalInfraPage });

interface ArenaRow { id: string; name: string; slug: string }
interface CamRow { id: string; arena_id: string; name: string; rtsp_url: string; button_id: string | null }
interface BoardRow { id: string; arena_id: string; name: string; serial: string; model: string }
interface BtnRow {
  id: string; arena_id: string; label: string;
  board_id: string | null; button_number: number | null;
  hardware_pin: string | null; camera_id: string | null;
}

function GlobalInfraPage() {
  const { user, loading, isSuperAdmin } = useAuth();
  const [arenas, setArenas] = useState<ArenaRow[]>([]);
  const [cameras, setCameras] = useState<CamRow[]>([]);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [buttons, setButtons] = useState<BtnRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  async function load() {
    setPageLoading(true);
    const [{ data: a }, { data: c }, { data: b }, { data: bt }] = await Promise.all([
      supabase.from("arenas").select("id,name,slug").order("name"),
      supabase.from("cameras").select("id,arena_id,name,rtsp_url,button_id").order("name"),
      supabase.from("zero_delay_boards").select("id,arena_id,name,serial,model").order("name"),
      supabase.from("arena_buttons").select("id,arena_id,label,board_id,button_number,hardware_pin,camera_id").order("button_number"),
    ]);
    setArenas((a ?? []) as ArenaRow[]);
    setCameras((c ?? []) as CamRow[]);
    setBoards((b ?? []) as BoardRow[]);
    setButtons((bt ?? []) as BtnRow[]);
    setPageLoading(false);
  }

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/acesso-negado" />;
  if (pageLoading) return <AppShell><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppShell>;

  return (
    <AppShell title="Gestão Global · Infraestrutura">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Infraestrutura Global</h1>
          <p className="text-sm text-muted-foreground">Câmeras, placas Zero Delay e mapeamento de pinos.</p>
        </div>
      </div>

      <Tabs defaultValue="cameras" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="cameras"><CameraIcon className="mr-2 h-4 w-4" />Câmeras</TabsTrigger>
          <TabsTrigger value="boards"><Cpu className="mr-2 h-4 w-4" />Placas ARC-968</TabsTrigger>
          <TabsTrigger value="mapping"><Cable className="mr-2 h-4 w-4" />Mapeamento Pino → Câmera</TabsTrigger>
          <TabsTrigger value="retencao"><Clock className="mr-2 h-4 w-4" />Retenção de Vídeos</TabsTrigger>
        </TabsList>

        <TabsContent value="cameras">
          <CamerasGlobal arenas={arenas} cameras={cameras} onChange={load} />
        </TabsContent>

        <TabsContent value="boards">
          <BoardsGlobal arenas={arenas} boards={boards} buttons={buttons} cameras={cameras} onChange={load} />
        </TabsContent>

        <TabsContent value="mapping">
          <MappingGlobal arenas={arenas} boards={boards} buttons={buttons} cameras={cameras} onChange={load} />
        </TabsContent>

        <TabsContent value="retencao">
          <RetentionCard />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function CamerasGlobal({ arenas, cameras, onChange }:
  { arenas: ArenaRow[]; cameras: CamRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [rtsp, setRtsp] = useState("");
  const [arenaId, setArenaId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [statusMap, setStatusMap] = useState<Record<string, "online" | "offline" | "checking">>({});

  useEffect(() => {
    const next: Record<string, "online" | "offline" | "checking"> = {};
    for (const c of cameras) {
      const ok = /^rtsps?:\/\/.+/i.test(c.rtsp_url) && Boolean(c.button_id);
      next[c.id] = ok ? "online" : "offline";
    }
    setStatusMap(next);
  }, [cameras]);

  const arenaName = (id: string) => arenas.find((a) => a.id === id)?.name ?? "—";
  const filtered = filter === "all" ? cameras : cameras.filter((c) => c.arena_id === filter);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!arenaId) return toast.error("Selecione a arena");
    if (!name.trim() || !rtsp.trim()) return toast.error("Preencha nome e RTSP");
    setBusy(true);
    const { error } = await supabase.from("cameras").insert({ arena_id: arenaId, name: name.trim(), rtsp_url: rtsp.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Câmera vinculada a ${arenaName(arenaId)}`);
    setName(""); setRtsp(""); onChange();
    notifyArena(arenaId, "cameras.updated");
  }

  async function remove(c: CamRow) {
    if (!confirm(`Remover câmera "${c.name}"?`)) return;
    const { error } = await supabase.from("cameras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Câmera removida");
    onChange();
    notifyArena(c.arena_id, "cameras.updated");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Câmeras cadastradas</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as arenas</SelectItem>
              {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {filtered.map((c) => {
            const status = statusMap[c.id] ?? "checking";
            return (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    <StatusBadge status={status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.rtsp_url}</p>
                  <p className="mt-1 text-xs">Arena: <span className="text-primary">{arenaName(c.arena_id)}</span></p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma câmera nesta arena.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Nova câmera</h2>
        <form onSubmit={add} className="space-y-4">
          <div>
            <Label>Arena</Label>
            <Select value={arenaId} onValueChange={setArenaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a arena..." /></SelectTrigger>
              <SelectContent>
                {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Câmera Quadra 1" required /></div>
          <div><Label>URL RTSP</Label><Input value={rtsp} onChange={(e) => setRtsp(e.target.value)} placeholder="rtsp://..." required /></div>
          <Button type="submit" className="w-full" disabled={busy || !arenaId}>
            {busy ? "Cadastrando..." : "Cadastrar câmera"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: "online" | "offline" | "checking" }) {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
        <Wifi className="h-3 w-3" /> Online
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
        <WifiOff className="h-3 w-3" /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      Verificando…
    </span>
  );
}

function BoardsGlobal({ arenas, boards, buttons, cameras, onChange }:
  { arenas: ArenaRow[]; boards: BoardRow[]; buttons: BtnRow[]; cameras: CamRow[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [arenaId, setArenaId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const arenaName = (id: string) => arenas.find((a) => a.id === id)?.name ?? "—";
  const cameraName = (id: string | null) => cameras.find((c) => c.id === id)?.name ?? null;
  const filtered = filter === "all" ? boards : boards.filter((b) => b.arena_id === filter);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!arenaId) return toast.error("Selecione a arena");
    if (!name.trim() || !serial.trim()) return toast.error("Preencha nome e serial");
    setBusy(true);
    const { error } = await supabase.from("zero_delay_boards").insert({ arena_id: arenaId, name: name.trim(), serial: serial.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Placa cadastrada · 12 pinos (K1–K12) gerados automaticamente");
    setName(""); setSerial(""); onChange();
    notifyArena(arenaId, "boards.updated");
  }

  async function remove(b: BoardRow) {
    if (!confirm(`Remover placa "${b.name}"? Os 12 pinos vinculados também serão excluídos.`)) return;
    const { error } = await supabase.from("zero_delay_boards").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Placa removida");
    onChange();
    notifyArena(b.arena_id, "boards.updated");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Placas Zero Delay (ARC-968)</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as arenas</SelectItem>
              {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4">
          {filtered.map((b) => {
            const pins = buttons.filter((bt) => bt.board_id === b.id)
              .sort((x, y) => (x.button_number ?? 0) - (y.button_number ?? 0));
            return (
              <div key={b.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{b.name} <span className="text-xs text-muted-foreground">· {b.model}</span></p>
                    <p className="text-xs text-muted-foreground">Serial: {b.serial} · Arena: <span className="text-primary">{arenaName(b.arena_id)}</span></p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {pins.map((p) => {
                    const occ = !!p.camera_id;
                    return (
                      <div key={p.id} className={`rounded-md border p-2 text-xs ${occ ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30"}`}>
                        <p className="font-semibold">{p.hardware_pin}</p>
                        <p className="mt-1 truncate">
                          {occ ? <span className="text-primary">{cameraName(p.camera_id)}</span> : <span className="text-muted-foreground">Livre</span>}
                        </p>
                      </div>
                    );
                  })}
                  {pins.length === 0 && <p className="col-span-full text-xs text-muted-foreground">Nenhum pino gerado.</p>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma placa nesta arena.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Nova placa</h2>
        <form onSubmit={add} className="space-y-4">
          <div>
            <Label>Arena</Label>
            <Select value={arenaId} onValueChange={setArenaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a arena..." /></SelectTrigger>
              <SelectContent>
                {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Placa Principal" required /></div>
          <div><Label>Serial</Label><Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="ARC968-001" required /></div>
          <p className="text-xs text-muted-foreground">A placa gera automaticamente os 12 pinos K1–K12, K11 e K12 inclusos.</p>
          <Button type="submit" className="w-full" disabled={busy || !arenaId}>{busy ? "Cadastrando..." : "Cadastrar placa"}</Button>
        </form>
      </Card>
    </div>
  );
}

function MappingGlobal({ arenas, boards, buttons, cameras, onChange }:
  { arenas: ArenaRow[]; boards: BoardRow[]; buttons: BtnRow[]; cameras: CamRow[]; onChange: () => void }) {
  const [arenaId, setArenaId] = useState<string>(arenas[0]?.id ?? "");
  useEffect(() => { if (!arenaId && arenas[0]) setArenaId(arenas[0].id); }, [arenas, arenaId]);

  const arenaBoards = boards.filter((b) => b.arena_id === arenaId);
  const arenaCameras = cameras.filter((c) => c.arena_id === arenaId);
  const arenaPins = buttons.filter((b) => b.arena_id === arenaId && b.board_id);

  async function assign(pinId: string, cameraId: string | null) {
    await supabase.from("cameras").update({ button_id: null }).eq("button_id", pinId);
    if (cameraId) {
      const { error } = await supabase.from("cameras").update({ button_id: pinId }).eq("id", cameraId);
      if (error) return toast.error(error.message);
      toast.success("Pino vinculado");
    } else {
      toast.success("Pino liberado");
    }
    onChange();
  }

  const map = arenaPins
    .sort((a, b) => (a.button_number ?? 0) - (b.button_number ?? 0))
    .map((b) => {
      const cam = cameras.find((c) => c.id === b.camera_id) ?? cameras.find((c) => c.button_id === b.id);
      return { pino: b.hardware_pin, camera_id: cam?.id ?? null, rtsp: cam?.rtsp_url ?? null };
    });
  const json = JSON.stringify(map, null, 2);

  async function copyJson() {
    try { await navigator.clipboard.writeText(json); toast.success("JSON copiado"); }
    catch { toast.error("Falha ao copiar"); }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Mapeamento Pino → Câmera</h2>
            <p className="text-sm text-muted-foreground">Associe cada pino físico das placas às câmeras da arena.</p>
          </div>
          <Select value={arenaId} onValueChange={setArenaId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione arena" /></SelectTrigger>
            <SelectContent>
              {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {arenaBoards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre uma placa ARC-968 nesta arena para liberar o mapeamento.</p>
        ) : (
          <div className="space-y-4">
            {arenaBoards.map((board) => {
              const pins = arenaPins.filter((b) => b.board_id === board.id)
                .sort((a, b) => (a.button_number ?? 0) - (b.button_number ?? 0));
              return (
                <div key={board.id} className="rounded-lg border border-border p-4">
                  <p className="mb-3 font-semibold">{board.name} <span className="text-xs text-muted-foreground">· {board.serial}</span></p>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {pins.map((p) => {
                      const linkedCam = cameras.find((c) => c.button_id === p.id) ?? cameras.find((c) => c.id === p.camera_id);
                      return (
                        <div key={p.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                          <span className="inline-flex h-8 min-w-[3rem] items-center justify-center rounded bg-primary/15 px-2 text-xs font-semibold text-primary">
                            {p.hardware_pin}
                          </span>
                          <Select
                            value={linkedCam?.id ?? "none"}
                            onValueChange={(v) => assign(p.id, v === "none" ? null : v)}
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Selecionar câmera" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Livre —</SelectItem>
                              {arenaCameras.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <Label>Mapa pino → câmera (JSON)</Label>
            <p className="text-xs text-muted-foreground">Gerado dinamicamente a partir do mapeamento acima. Cole no script Python local da arena.</p>
          </div>
          <Button size="sm" variant="outline" onClick={copyJson} disabled={map.length === 0}>Copiar JSON</Button>
        </div>
        <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">{json}</pre>
        {map.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nada para exportar ainda.</p>}
      </Card>
    </div>
  );
}

/* ----------------------------- Retenção de vídeos ----------------------------- */

function RetentionCard() {
  const [days, setDays] = useState<string>("30");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { getRetentionSettings } = await import("@/lib/arena-admin.functions");
        const r = await getRetentionSettings();
        setDays(String(r.default_retention_days));
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    const n = parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1) return toast.error("Informe um número válido de dias");
    setBusy(true);
    try {
      const { updateRetentionSettings } = await import("@/lib/arena-admin.functions");
      await updateRetentionSettings({ data: { default_retention_days: n } });
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    if (!confirm("Executar limpeza agora? Vídeos antigos das arenas configuradas serão apagados.")) return;
    setRunning(true);
    setLastResult(null);
    try {
      const { runCleanupNow } = await import("@/lib/arena-admin.functions");
      const res = await runCleanupNow();
      setLastResult(res);
      toast.success("Limpeza executada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao executar");
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Card className="p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></Card>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Retenção padrão</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Quantidade de dias que vídeos ficam armazenados. Cada arena pode sobrescrever esse valor
          em <strong>Arena → Conexão</strong>. Limpeza roda diariamente às 03:00 (UTC).
        </p>
        <div className="flex items-end gap-3">
          <div>
            <Label>Dias</Label>
            <Input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} className="w-32" />
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-base font-semibold">Executar limpeza agora</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Roda imediatamente o processo de retenção em todas as arenas com Supabase próprio configurado
          (URL + service key).
        </p>
        <Button onClick={runNow} disabled={running} variant="outline">
          {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Executando...</> : "Rodar agora"}
        </Button>

        {lastResult && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Padrão usado: <strong>{lastResult.default_days} dias</strong>
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-3">Arena</th><th className="p-3">Apagados</th><th className="p-3">Erro</th></tr>
                </thead>
                <tbody>
                  {(lastResult.processed ?? []).map((p: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 font-medium">{p.arena}</td>
                      <td className="p-3">{p.deleted}</td>
                      <td className="p-3 text-xs text-destructive">{p.error ?? "—"}</td>
                    </tr>
                  ))}
                  {(lastResult.processed ?? []).length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhuma arena com Supabase próprio configurado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
