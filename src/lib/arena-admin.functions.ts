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

