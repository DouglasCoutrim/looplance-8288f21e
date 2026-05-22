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
  retention_days: z.number().int().min(1).max(3650).nullable(),
});

export const updateArenaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConnSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const update = {
      retention_days: data.retention_days,
    };

    const { error } = await context.supabase.from("arenas").update(update).eq("id", data.arenaId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/* -------- Global retention setting -------- */

export const getRetentionSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { data } = await context.supabase.from("app_settings").select("value").eq("key", "default_retention_days").maybeSingle();
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
    const { error } = await context.supabase
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
    const { data: rows, error } = await context.supabase
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
    const { data: row, error } = await context.supabase
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
    const { error } = await context.supabase
      .from("arena_ingest_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId)
      .eq("arena_id", data.arenaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
