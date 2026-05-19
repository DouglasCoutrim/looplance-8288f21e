import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BucketVideo {
  name: string;
  url: string;
  createdAt: string | null;
  size: number | null;
}

interface Props {
  arenaId: string;
  bucket?: string | null;
  /** Optional folder/prefix inside the bucket (ex: court id). */
  prefix?: string | null;
  brand?: string;
}

/**
 * Lê os arquivos diretamente do bucket de Storage do Supabase EXTERNO
 * através de uma Edge Function para evitar problemas de CSP.
 */
export function BucketVideoFeed({
  arenaId,
  bucket,
  prefix,
  brand = "#FF6600",
}: Props) {
  const [videos, setVideos] = useState<BucketVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BucketVideo | null>(null);

  const bucketName = bucket?.trim() || "replays";
  const folder = (prefix ?? "").replace(/^\/+|\/+$/g, "");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!arenaId) {
          throw new Error("ID da arena não fornecido.");
        }

        const { data, error: funcError } = await supabase.functions.invoke("list-arena-videos", {
          body: { arenaId, bucket: bucketName, prefix: folder },
        });

        if (funcError) throw funcError;
        if (data.error) throw new Error(data.error);

        const mapped: BucketVideo[] = data.videos || [];

        mapped.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        
        if (cancel) return;
        setVideos(mapped);
        setSelected(mapped[0] ?? null);
      } catch (e) {
        if (cancel) return;
        setError(e instanceof Error ? e.message : "Falha ao listar vídeos.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [arenaId, bucketName, folder]);

  const groups = useMemo(() => {
    const m = new Map<string, BucketVideo[]>();
    videos.forEach((v) => {
      const key = v.createdAt ? v.createdAt.slice(0, 10) : "sem-data";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(v);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [videos]);

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: brand }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Nenhum arquivo encontrado no bucket <code className="font-mono">{bucketName}</code>
        {folder ? <> em <code className="font-mono">/{folder}</code></> : null}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        {selected ? (
          <video
            key={selected.url}
            src={selected.url}
            controls
            playsInline
            className="aspect-video w-full bg-black"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center text-white/60">
            <PlayCircle className="h-12 w-12 opacity-40" />
          </div>
        )}
      </div>

      {groups.map(([day, items]) => (
        <div key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {day === "sem-data"
              ? "Sem data"
              : format(new Date(day + "T00:00:00"), "dd 'de' MMMM yyyy", { locale: ptBR })}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((v) => {
              const active = selected?.url === v.url;
              const hora = v.createdAt
                ? new Date(v.createdAt).toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <button
                  key={v.url}
                  onClick={() => setSelected(v)}
                  className={`group overflow-hidden rounded-xl border text-left transition ${
                    active ? "ring-2" : "border-border"
                  }`}
                  style={{
                    borderColor: active ? brand : undefined,
                    boxShadow: active ? `0 0 0 1px ${brand}` : undefined,
                  }}
                >
                  <div className="relative aspect-video w-full bg-black">
                    <video
                      src={v.url}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                    {hora && (
                      <span
                        className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                        style={{ backgroundColor: brand }}
                      >
                        {hora}
                      </span>
                    )}
                  </div>
                  <p className="truncate p-2 text-[11px] text-muted-foreground" title={v.name}>
                    {v.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
