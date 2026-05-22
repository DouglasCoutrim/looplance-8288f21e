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

interface ArenaRow { id: string; name: string; slug: string }

function GlobalInfraPage() {
  const { user, loading, isSuperAdmin } = useAuth();
  const [arenas, setArenas] = useState<ArenaRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  async function load() {
    setPageLoading(true);
    const [{ data: a }] = await Promise.all([
      supabase.from("arenas").select("id,name,slug").order("name"),
    ]);
    setArenas((a ?? []) as ArenaRow[]);
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
          <p className="text-sm text-muted-foreground">Configurações globais de infraestrutura e manutenção.</p>
        </div>
      </div>

      <Tabs defaultValue="retencao" className="w-full">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="retencao"><Clock className="mr-2 h-4 w-4" />Limpeza de Dados</TabsTrigger>
        </TabsList>


        <TabsContent value="retencao">
          <RetentionCard />
        </TabsContent>
      </Tabs>
    </AppShell>
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
          em <strong>Arena → Configurações</strong>. Limpeza roda diariamente às 03:00 (UTC).
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
          Roda imediatamente o processo de retenção em todas as arenas.
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
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhuma arena processada.</td></tr>
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
