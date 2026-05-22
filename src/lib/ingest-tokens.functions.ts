import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

const uuid = z.string().uuid();

async function assertArenaAdmin(supabase: any, userId: string, arenaId: string) {
  const { data, error } = await supabase.rpc('is_arena_admin', {
    _user_id: userId,
    _arena_id: arenaId,
  });
  if (error) throw new Error(error.message);
  if (!data) {
    const { data: sa } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'superadmin',
    });
    if (!sa) throw new Error('Forbidden');
  }
}

export const listIngestTokens = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { arenaId: string }) => ({ arenaId: uuid.parse(i.arenaId) }))
  .handler(async ({ data, context }) => {
    await assertArenaAdmin(context.supabase, context.userId, data.arenaId);
    const { data: rows, error } = await context.supabase
      .from('arena_ingest_tokens')
      .select('id, name, token_prefix, created_at, last_used_at, revoked_at')
      .eq('arena_id', data.arenaId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { tokens: rows ?? [] };
  });

export const createIngestToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { arenaId: string; name: string }) => ({
    arenaId: uuid.parse(i.arenaId),
    name: z.string().trim().min(1).max(80).parse(i.name),
  }))
  .handler(async ({ data, context }) => {
    await assertArenaAdmin(context.supabase, context.userId, data.arenaId);
    const raw = randomBytes(32).toString('base64url'); // 43 chars
    const token = `arn_${raw}`;
    const hash = createHash('sha256').update(token).digest('hex');
    const prefix = token.slice(0, 12);

    const { data: row, error } = await context.supabase
      .from('arena_ingest_tokens')
      .insert({
        arena_id: data.arenaId,
        name: data.name,
        token_hash: hash,
        token_prefix: prefix,
        created_by: context.userId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, token }; // shown ONCE
  });

export const revokeIngestToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tokenId: string }) => ({ tokenId: uuid.parse(i.tokenId) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('arena_ingest_tokens')
      .select('arena_id')
      .eq('id', data.tokenId)
      .maybeSingle();
    if (error || !row) throw new Error('Token not found');
    await assertArenaAdmin(context.supabase, context.userId, row.arena_id);
    const { error: upErr } = await context.supabase
      .from('arena_ingest_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', data.tokenId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });
