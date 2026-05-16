import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TopReplay {
  id: string;
  video_id: string | null;
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
  created_at: string;
}

const LIMIT = 3;
const SELECT =
  "id, video_id, arena_id, arena_name, arena_slug, arena_primary_color, arena_logo_url, court_id, court_name, title, video_url, thumbnail_url, created_at";

function sortDesc(list: TopReplay[]): TopReplay[] {
  const seen = new Set<string>();
  return list
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, LIMIT);
}

export function useTopReplays() {
  const [replays, setReplays] = useState<TopReplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("global_replays" as never)
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (cancelled) return;
      if (error) {
        console.error("[useTopReplays] load failed", error.message);
      } else if (data) {
        setReplays(sortDesc(data as unknown as TopReplay[]));
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel("home-top-replays")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_replays" },
        (payload) => {
          const row = payload.new as TopReplay;
          if (!row?.id) return;
          setReplays((prev) => sortDesc([row, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_replays" },
        (payload) => {
          const row = payload.new as TopReplay;
          if (!row?.id) return;
          setReplays((prev) =>
            sortDesc(prev.map((r) => (r.id === row.id ? row : r))),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "global_replays" },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id) return;
          setReplays((prev) => prev.filter((r) => r.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { replays, loading };
}
