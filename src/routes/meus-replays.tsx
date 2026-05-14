import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Scissors, Download, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/meus-replays")({
  component: MyReplays,
  head: () => ({ meta: [{ title: "Meus Replays — LoopLance" }] }),
});

interface Job {
  id: string;
  arena_id: string;
  source_video_url: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  aspect_ratio: string;
  status: string;
  duracao_segundos: number;
  timestamp_inicio: number;
  created_at: string;
}
interface ArenaInfo { id: string; name: string; slug: string; logo_url: string | null; primary_color: string }

function MyReplays() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [arenas, setArenas] = useState<Record<string, ArenaInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("replay_jobs" as never)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const jobsData = (data ?? []) as Job[];
      setJobs(jobsData);
      const ids = Array.from(new Set(jobsData.map((j) => j.arena_id)));
      if (ids.length) {
        const { data: a } = await supabase.from("public_arenas" as never)
          .select("id,name,slug,logo_url,primary_color").in("id", ids);
        const map: Record<string, ArenaInfo> = {};
        (a as ArenaInfo[] | null)?.forEach((x) => { map[x.id] = x; });
        setArenas(map);
      }
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate({ to: "/" })} className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold">Meus Replays</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : jobs.length === 0 ? (
          <Card className="py-12 text-center">
            <Scissors className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-4 text-sm text-muted-foreground">Você ainda não gerou replays.</p>
            <Link to="/"><Button>Encontrar uma arena</Button></Link>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.map((j) => <JobCard key={j.id} job={j} arena={arenas[j.arena_id]} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function JobCard({ job, arena }: { job: Job; arena?: ArenaInfo }) {
  const status = statusInfo(job.status);
  const brand = arena?.primary_color || "#FF6600";
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        {job.thumbnail_url ? (
          <img src={job.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : job.source_video_url ? (
          <video src={job.source_video_url} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/40"><Scissors className="h-8 w-8" /></div>
        )}
        <Badge className="absolute left-2 top-2 border-0 text-white" style={{ backgroundColor: brand }}>
          {arena?.name ?? "Arena"}
        </Badge>
        <Badge className={`absolute right-2 top-2 border-0 ${status.cls}`}>
          <status.Icon className="mr-1 h-3 w-3" /> {status.label}
        </Badge>
      </div>
      <div className="space-y-1 p-3">
        <p className="text-sm font-semibold">{job.aspect_ratio} · {job.duracao_segundos}s</p>
        <p className="text-xs text-muted-foreground">
          Início em {fmt(job.timestamp_inicio)} · {format(new Date(job.created_at), "dd MMM, HH:mm", { locale: ptBR })}
        </p>
        {job.output_url && (
          <a href={job.output_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
            <Button size="sm" className="w-full"><Download className="mr-1 h-3.5 w-3.5" /> Baixar</Button>
          </a>
        )}
      </div>
    </Card>
  );
}

function statusInfo(s: string) {
  switch (s) {
    case "done":
    case "completed":
      return { label: "Pronto", Icon: CheckCircle2, cls: "bg-green-600 text-white" };
    case "processing":
      return { label: "Processando", Icon: Loader2, cls: "bg-blue-600 text-white" };
    case "failed":
    case "error":
      return { label: "Erro", Icon: XCircle, cls: "bg-red-600 text-white" };
    default:
      return { label: "Pendente", Icon: Clock, cls: "bg-yellow-500 text-black" };
  }
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
