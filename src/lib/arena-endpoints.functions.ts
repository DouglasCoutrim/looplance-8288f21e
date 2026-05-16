import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ArenaEndpoint = {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  supabase_url: string;
  supabase_anon_key: string;
  videos_bucket: string;
};

/**
 * Public: returns active arenas that have an external Supabase configured.
 * Anon key is safe to expose to the browser (publishable). RLS in each
 * external DB must restrict what anon can SELECT.
 */
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

    return (data ?? [])
      .filter((a) => a.supabase_url && a.supabase_anon_key)
      .map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        primary_color: a.primary_color,
        logo_url: a.logo_url,
        supabase_url: a.supabase_url as string,
        supabase_anon_key: a.supabase_anon_key as string,
        videos_bucket: a.videos_bucket ?? "replays",
      }));
  },
);
