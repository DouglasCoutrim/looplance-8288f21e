import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  arenaId: z.string().uuid(),
  fullName: z.string().trim().max(120).optional(),
});

/**
 * Invite a user by email and assign them admin_arena role for the given arena.
 * Caller must be a superadmin.
 */
export const inviteArenaOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is superadmin
    const { data: isSuper, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isSuper) throw new Error("Apenas superadmin pode convidar donos de arena.");

    // Verify arena exists
    const { data: arena, error: arenaErr } = await supabaseAdmin
      .from("arenas")
      .select("id, name")
      .eq("id", data.arenaId)
      .maybeSingle();
    if (arenaErr) throw new Error(arenaErr.message);
    if (!arena) throw new Error("Arena não encontrada.");

    // Check if user already exists
    let targetUserId: string | null = null;
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id",
        // dummy filter; we'll search via auth.admin instead
        "00000000-0000-0000-0000-000000000000",
      )
      .maybeSingle();
    void existingProfile;

    // Use auth admin listUsers to find by email
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const found = list.users.find((u) => u.email?.toLowerCase() === data.email);

    let invited = false;
    if (found) {
      targetUserId = found.id;
    } else {
      const { data: invite, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        {
          data: data.fullName ? { full_name: data.fullName } : undefined,
        },
      );
      if (invErr) throw new Error(invErr.message);
      targetUserId = invite.user?.id ?? null;
      invited = true;
    }

    if (!targetUserId) throw new Error("Falha ao obter ID do usuário convidado.");

    // Ensure profile row exists (the handle_new_user trigger should create it on first sign-in,
    // but inviteUserByEmail also fires it; double-insert is safe with ON CONFLICT)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: targetUserId, full_name: data.fullName ?? data.email }, { onConflict: "id" });

    // Assign admin_arena role for this arena (idempotent)
    const { error: roleInsErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: targetUserId, role: "admin_arena", arena_id: data.arenaId },
        { onConflict: "user_id,role,arena_id", ignoreDuplicates: true },
      );
    if (roleInsErr) throw new Error(roleInsErr.message);

    // Set arena.owner_id
    await supabaseAdmin.from("arenas").update({ owner_id: targetUserId }).eq("id", data.arenaId);

    return {
      ok: true,
      invited,
      userId: targetUserId,
      arenaName: arena.name,
    };
  });
