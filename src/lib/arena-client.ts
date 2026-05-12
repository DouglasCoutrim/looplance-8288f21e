import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const cache = new Map<string, SupabaseClient>();

/**
 * Returns a Supabase client for an arena's LOCAL database, using its anon key.
 * Anon key is safe to expose in the browser; RLS in the local DB protects data.
 */
export function getArenaClient(url: string, anonKey: string): SupabaseClient {
  const key = `${url}::${anonKey}`;
  let client = cache.get(key);
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cache.set(key, client);
  }
  return client;
}
