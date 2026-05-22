import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgentNotifyReason =
  | "arena.updated"
  | "courts.updated"
  | "boards.updated"
  | "buttons.updated";

/**
 * Legado: Esta função não faz mais nada pois a arquitetura de webhooks do agente foi removida.
 * Mantida apenas para evitar erros de compilação em arquivos que ainda a importam.
 */
export async function notifyAgent(arenaId: string, reason: AgentNotifyReason): Promise<{ ok: boolean; skipped?: string }> {
  console.log(`[notifyAgent] Ignorando notificação (arquitetura antiga): ${arenaId} - ${reason}`);
  return { ok: true, skipped: "deprecated" };
}
