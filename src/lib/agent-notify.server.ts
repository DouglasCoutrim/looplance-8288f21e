import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgentNotifyReason =
  | "arena.updated"
  | "courts.updated"
  | "cameras.updated"
  | "court_cameras.updated"
  | "boards.updated"
  | "buttons.updated";

const TIMEOUT_MS = 3000;
const MAX_RETRIES = 2;

async function postOnce(url: string, body: string, signature: string) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Signature": `sha256=${signature}`,
      },
      body,
      signal: ac.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function notifyAgent(arenaId: string, reason: AgentNotifyReason): Promise<{ ok: boolean; skipped?: string }> {
  const { data: arena, error } = await supabaseAdmin
    .from("arenas")
    .select("agent_webhook_url, agent_webhook_secret, config_version")
    .eq("id", arenaId)
    .maybeSingle();

  if (error || !arena) return { ok: false, skipped: "arena_not_found" };
  if (!arena.agent_webhook_url) return { ok: true, skipped: "no_webhook" };

  const payload = {
    arena_id: arenaId,
    reason,
    config_version: arena.config_version ?? 0,
    ts: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  const secret = arena.agent_webhook_secret ?? "";
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ok = await postOnce(arena.agent_webhook_url, body, signature);
    if (ok) return { ok: true };
    if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  console.warn("[notifyAgent] webhook failed", { arenaId, reason, url: arena.agent_webhook_url });
  return { ok: false, skipped: "webhook_failed" };
}
