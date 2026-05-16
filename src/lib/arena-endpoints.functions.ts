import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ArenaCourt = { id: string; name: string };

export type ArenaEndpoint = {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  supabase_url: string;
  supabase_anon_key: string;
  videos_bucket: string;
  courts: ArenaCourt[];
};

export const listArenaEndpoints = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArenaEndpoint[]> => {
    const { data, error } = await supabaseAdmin
      .from("arenas")
      .select(
        "id, name, slug, primary_color, logo_url, supabase_url, supabase_anon_key, videos_bucket",
      )
      .eq("active", true)
      .not("supabase_url", "is", null)
      .not("supabase_anon_key", "is", null);

    if (error) throw new Error(error.message);

    const arenas = (data ?? []).filter((a) => a.supabase_url && a.supabase_anon_key);
    if (arenas.length === 0) return [];

    const { data: courtsData } = await supabaseAdmin
      .from("courts")
      .select("id, name, arena_id")
      .in("arena_id", arenas.map((a) => a.id));

    const courtsByArena = new Map<string, ArenaCourt[]>();
    for (const c of courtsData ?? []) {
      const list = courtsByArena.get(c.arena_id) ?? [];
      list.push({ id: c.id, name: c.name });
      courtsByArena.set(c.arena_id, list);
    }

    return arenas.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      primary_color: a.primary_color,
      logo_url: a.logo_url,
      supabase_url: a.supabase_url as string,
      supabase_anon_key: a.supabase_anon_key as string,
      videos_bucket: a.videos_bucket ?? "replays",
      courts: courtsByArena.get(a.id) ?? [],
    }));
  },
);
