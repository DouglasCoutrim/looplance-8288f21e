import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function runCleanupRoutine() {
  const { data: setting } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "default_retention_days")
    .maybeSingle();
  const defaultDays = typeof setting?.value === "number" ? (setting.value as number) : 30;

  const { data: arenas, error } = await supabaseAdmin
    .from("arenas")
    .select("id,name,supabase_url,supabase_service_key,videos_bucket,retention_days")
    .not("supabase_url", "is", null)
    .not("supabase_service_key", "is", null);
  if (error) throw new Error(error.message);

  const summary: Array<{ arena: string; deleted: number; error?: string }> = [];

  for (const a of (arenas ?? []) as any[]) {
    const days = a.retention_days ?? defaultDays;
    const bucket = a.videos_bucket ?? "replays";
    const url = a.supabase_url as string;
    const key = a.supabase_service_key as string;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: olds, error: qErr } = await client
        .from("videos")
        .select("id, video_url")
        .lt("created_at", cutoff);
      if (qErr) throw new Error(qErr.message);

      const rows = (olds ?? []) as Array<{ id: string; video_url: string | null }>;
      if (rows.length === 0) {
        summary.push({ arena: a.name, deleted: 0 });
        continue;
      }

      const paths: string[] = [];
      for (const r of rows) {
        const u = r.video_url ?? "";
        const m = u.match(new RegExp(`/object/public/${bucket}/(.+)$`));
        if (m) paths.push(decodeURIComponent(m[1]));
        else if (u && !/^https?:\/\//i.test(u)) paths.push(u.replace(/^\/+/, ""));
      }
      if (paths.length > 0) await client.storage.from(bucket).remove(paths);

      const ids = rows.map((r) => r.id);
      const { error: delErr } = await client.from("videos").delete().in("id", ids);
      if (delErr) throw new Error(delErr.message);

      summary.push({ arena: a.name, deleted: rows.length });
    } catch (e: any) {
      summary.push({ arena: a.name, deleted: 0, error: e?.message ?? String(e) });
    }
  }

  return { ok: true, default_days: defaultDays, processed: summary };
}
