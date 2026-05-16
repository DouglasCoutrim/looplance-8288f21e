import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCleanupRoutine } from "@/lib/cleanup.server";
import { notifyAgent } from "@/lib/agent-notify.server";

async function assertArenaAdminOrSuper(supabase: any, userId: string, arenaId: string) {
  const [sup, adm] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
    supabase.rpc("is_arena_admin", { _user_id: userId, _arena_id: arenaId }),
  ]);
  if (sup.error) throw new Error(sup.error.message);
  if (adm.error) throw new Error(adm.error.message);
  if (!sup.data && !adm.data) throw new Error("Sem permissão nesta arena.");
}

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
  agent_webhook_url: z.string().trim().url().nullable().optional(),
  agent_webhook_secret: z.string().trim().min(1).nullable().optional(),
});

export const updateArenaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const update: {
      supabase_url: string | null;
      supabase_anon_key: string | null;
      videos_bucket: string | null;
      retention_days: number | null;
      supabase_service_key?: string;
      agent_webhook_url?: string | null;
      agent_webhook_secret?: string;
    } = {
      supabase_url: data.supabase_url,
      supabase_anon_key: data.supabase_anon_key,
      videos_bucket: data.videos_bucket,
      retention_days: data.retention_days,
    };
    if (data.supabase_service_key) update.supabase_service_key = data.supabase_service_key;
    if (data.agent_webhook_url !== undefined) update.agent_webhook_url = data.agent_webhook_url;
    if (data.agent_webhook_secret) update.agent_webhook_secret = data.agent_webhook_secret;

    const { error } = await supabaseAdmin.from("arenas").update(update).eq("id", data.arenaId);
    if (error) throw new Error(error.message);

    // Fire-and-forget: notify the agent so it reloads config immediately.
    notifyAgent(data.arenaId, "arena.updated").catch(() => {});
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


/* -------- Arena ingest tokens (agent auth) -------- */

const ArenaIdSchema = z.object({ arenaId: z.string().uuid() });

export const listArenaIngestTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ArenaIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertArenaAdminOrSuper(context.supabase, context.userId, data.arenaId);
    const { data: rows, error } = await supabaseAdmin
      .from("arena_ingest_tokens")
      .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
      .eq("arena_id", data.arenaId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tokens: rows ?? [] };
  });

const CreateTokenSchema = z.object({
  arenaId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const createArenaIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateTokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertArenaAdminOrSuper(context.supabase, context.userId, data.arenaId);
    const raw = randomBytes(32).toString("base64url");
    const token = `lov_ing_${raw}`;
    const token_hash = createHash("sha256").update(token).digest("hex");
    const token_prefix = token.slice(0, 12);
    const { data: row, error } = await supabaseAdmin
      .from("arena_ingest_tokens")
      .insert({
        arena_id: data.arenaId,
        name: data.name,
        token_hash,
        token_prefix,
        created_by: context.userId,
      })
      .select("id, name, token_prefix, created_at, last_used_at, revoked_at")
      .single();
    if (error) throw new Error(error.message);
    return { token, row };
  });

const RevokeTokenSchema = z.object({
  arenaId: z.string().uuid(),
  tokenId: z.string().uuid(),
});

export const revokeArenaIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeTokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertArenaAdminOrSuper(context.supabase, context.userId, data.arenaId);
    const { error } = await supabaseAdmin
      .from("arena_ingest_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId)
      .eq("arena_id", data.arenaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
