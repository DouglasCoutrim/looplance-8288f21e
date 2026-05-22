import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const GLOBAL_LIMIT = 60;

export function useGlobalReplays() {
  const [replays, setReplays] = useState<GlobalReplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("global_replays" as never)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(GLOBAL_LIMIT);

        if (error) throw error;
        if (cancelled) return;

        setReplays((data ?? []) as unknown as GlobalReplay[]);
      } catch (e) {
        console.error("useGlobalReplays failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Realtime listener
    const channel = supabase
      .channel("replays_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "replays" },
        () => {
          // Simplest way: refresh the list to get joined data from the view
          (async () => {
            const { data } = await supabase
              .from("global_replays" as never)
              .select("*")
              .order("created_at", { ascending: false })
              .limit(GLOBAL_LIMIT);
            if (data) setReplays(data as unknown as GlobalReplay[]);
          })();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { replays, loading };
}
