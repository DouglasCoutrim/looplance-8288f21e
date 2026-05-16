import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getArenaClient } from "@/lib/arena-client";
import { listArenaEndpoints, type ArenaEndpoint } from "@/lib/arena-endpoints.functions";

export interface GlobalReplay {
  id: string;
  arena_id: string;
  arena_name: string;
  arena_slug: string;
  arena_primary_color: string;
  arena_logo_url: string | null;
  court_id: string | null;
  court_name: string | null;
  title: string | null;
  video_url: string;
  thumbnail_url: string | null;
  data_evento: string;
  hora_evento: string;
  created_at: string;
}

type ReplayRow = {
  id: string;
  quadra_id: string | null;
  video_url: string;
  thumb_url: string | null;
  created_at: string | null;
};

const PER_ARENA_LIMIT = 20;
const GLOBAL_LIMIT = 60;

function rowToReplay(row: ReplayRow, arena: ArenaEndpoint): GlobalReplay {
  const created = row.created_at ?? new Date().toISOString();
  const d = new Date(created);
  return {
    id: `${arena.id}:${row.id}`,
    arena_id: arena.id,
    arena_name: arena.name,
    arena_slug: arena.slug,
    arena_primary_color: arena.primary_color,
    arena_logo_url: arena.logo_url,
    court_id: row.quadra_id,
    court_name: null,
    title: null,
    video_url: row.video_url,
    thumbnail_url: row.thumb_url,
    data_evento: d.toISOString().slice(0, 10),
    hora_evento: d.toISOString().slice(11, 19),
    created_at: created,
  };
}

function mergeSorted(items: GlobalReplay[]): GlobalReplay[] {
  const seen = new Set<string>();
  return items
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, GLOBAL_LIMIT);
}

export function useGlobalReplays() {
  const fetchEndpoints = useServerFn(listArenaEndpoints);
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [loading, setLoading] = useState(true);
  const byArenaRef = useRef<Map<string, GlobalReplay[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const flush = () => {
      const all: GlobalReplay[] = [];
      byArenaRef.current.forEach((list) => all.push(...list));
      setReplays(mergeSorted(all));
    };

    (async () => {
      let arenas: ArenaEndpoint[] = [];
      try {
        arenas = await fetchEndpoints();
      } catch (e) {
        console.error("listArenaEndpoints failed", e);
      }
      if (cancelled) return;

      if (arenas.length === 0) {
        setLoading(false);
        return;
      }

      await Promise.all(
        arenas.map(async (arena) => {
          const client = getArenaClient(arena.supabase_url, arena.supabase_anon_key);

          // Initial load
          const { data, error } = await client
            .from("replays")
            .select("id, quadra_id, video_url, thumb_url, created_at")
            .order("created_at", { ascending: false })
            .limit(PER_ARENA_LIMIT);
          if (error) {
            console.error(`[${arena.slug}] load failed`, error.message);
          } else if (data) {
            byArenaRef.current.set(
              arena.id,
              (data as ReplayRow[]).map((row) => rowToReplay(row, arena)),
            );
          }
          if (cancelled) return;
          flush();

          // Realtime
          const channel = client
            .channel(`replays-${arena.id}`)
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "replays" },
              (payload) => {
                const row = payload.new as ReplayRow;
                if (!row?.id) return;
                const next = [
                  rowToReplay(row, arena),
                  ...(byArenaRef.current.get(arena.id) ?? []),
                ].slice(0, PER_ARENA_LIMIT);
                byArenaRef.current.set(arena.id, next);
                flush();
              },
            )
            .subscribe();

          cleanups.push(() => {
            client.removeChannel(channel);
          });
        }),
      );

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      byArenaRef.current.clear();
    };
  }, [fetchEndpoints]);

  return { replays, loading };
}
