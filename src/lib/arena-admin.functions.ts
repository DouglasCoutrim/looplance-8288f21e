import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCleanupRoutine } from "@/lib/cleanup.server";

async function assertSuper(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas superadmin.");
}

/* -------- Update arena connection (incl. service key, server-only) -------- */

const ConnSchema = z.object({
  arenaId: z.string().uuid(),
  supabase_url: z.string().trim().url().nullable(),
  supabase_anon_key: z.string().trim().min(1).nullable(),
  supabase_service_key: z.string().trim().min(1).nullable().optional(),
  videos_bucket: z.string().trim().min(1).max(120).nullable(),
  retention_days: z.number().int().min(1).max(3650).nullable(),
});

export const updateArenaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const update = {
      supabase_url: data.supabase_url,
      supabase_anon_key: data.supabase_anon_key,
      videos_bucket: data.videos_bucket,
      retention_days: data.retention_days,
      ...(data.supabase_service_key ? { supabase_service_key: data.supabase_service_key } : {}),
    };
    const { error } = await supabaseAdmin.from("arenas").update(update).eq("id", data.arenaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Global retention setting -------- */

export const getRetentionSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "default_retention_days").maybeSingle();
    const value = data?.value as unknown;
    const days = typeof value === "number" ? value : 30;
    return { default_retention_days: days };
  });

const RetSchema = z.object({ default_retention_days: z.number().int().min(1).max(3650) });

export const updateRetentionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: "default_retention_days", value: data.default_retention_days as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Manual cleanup trigger (calls shared routine) -------- */

export const runCleanupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const result = await runCleanupRoutine();
    return result;
  });

/* -------- Shared cleanup routine (also used by cron route) -------- */

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

  for (const a of arenas ?? []) {
    const days = (a as any).retention_days ?? defaultDays;
    const bucket = (a as any).videos_bucket ?? "replays";
    const url = (a as any).supabase_url as string;
    const key = (a as any).supabase_service_key as string;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: olds, error: qErr } = await client
        .from("videos")
        .select("id, video_url")
        .lt("created_at", cutoff);
      if (qErr) throw new Error(qErr.message);

      const rows = olds ?? [];
      if (rows.length === 0) {
        summary.push({ arena: (a as any).name, deleted: 0 });
        continue;
      }

      // Extract storage paths from URLs (anything after `/object/public/<bucket>/`)
      const paths: string[] = [];
      for (const r of rows as any[]) {
        const u: string = r.video_url ?? "";
        const m = u.match(new RegExp(`/object/public/${bucket}/(.+)$`));
        if (m) paths.push(decodeURIComponent(m[1]));
        else if (u && !/^https?:\/\//i.test(u)) paths.push(u.replace(/^\/+/, ""));
      }
      if (paths.length > 0) {
        await client.storage.from(bucket).remove(paths);
      }

      const ids = (rows as any[]).map((r) => r.id);
      const { error: delErr } = await client.from("videos").delete().in("id", ids);
      if (delErr) throw new Error(delErr.message);

      summary.push({ arena: (a as any).name, deleted: rows.length });
    } catch (e: any) {
      summary.push({ arena: (a as any).name, deleted: 0, error: e?.message ?? String(e) });
    }
  }

  return { ok: true, default_days: defaultDays, processed: summary };
}
