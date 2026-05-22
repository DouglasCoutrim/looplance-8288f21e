import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyAgent } from "./agent-notify.server";

const Schema = z.object({
  arenaId: z.string().uuid(),
  reason: z.enum([
    "arena.updated",
    "courts.updated",
  ]),
});

export const notifyArenaAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    // Authorization: arena admin or superadmin
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
      context.supabase.rpc("is_arena_admin", { _user_id: context.userId, _arena_id: data.arenaId }),
    ]);
    if (!isSuper && !isAdmin) throw new Error("Sem permissão para notificar esta arena.");

    return await notifyAgent(data.arenaId, data.reason);
  });
