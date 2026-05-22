import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createHash } from 'crypto';

export const Route = createFileRoute('/api/public/agent/config')({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }),

      GET: async ({ request }) => {
        const cors = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        };
        const fail = (status: number, error: string) =>
          new Response(JSON.stringify({ error }), { status, headers: cors });

        // Auth: Bearer token
        const auth = request.headers.get('authorization') || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        if (!token || token.length < 16 || token.length > 200) {
          return fail(401, 'Missing or invalid bearer token');
        }
        const tokenHash = createHash('sha256').update(token).digest('hex');

        const { data: tokenRow, error: tokenErr } = await supabaseAdmin
          .from('arena_ingest_tokens')
          .select('id, arena_id, revoked_at')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (tokenErr || !tokenRow || tokenRow.revoked_at) {
          return fail(401, 'Invalid or revoked token');
        }
        const arenaId = tokenRow.arena_id;

        // Load arena scope in parallel
        const [arenaRes, courtsRes] = await Promise.all([
          supabaseAdmin
            .from('arenas')
            .select('id, name, slug, active, videos_bucket, retention_days, supabase_url, supabase_anon_key, supabase_service_key, config_version')
            .eq('id', arenaId)
            .maybeSingle(),
          supabaseAdmin
            .from('courts' as any)
            .select('id, name, rtsp_url')
            .eq('arena_id', arenaId)
            .then((res: any) => res, () => ({ data: [] })),
        ]);

        if (arenaRes.error || !arenaRes.data) return fail(500, 'Arena not found');

        // Update last_used_at (non-blocking best effort)
        await supabaseAdmin
          .from('arena_ingest_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokenRow.id);

        return new Response(
          JSON.stringify({
            ok: true,
            generated_at: new Date().toISOString(),
            config_version: (arenaRes.data as any).config_version ?? 0,
            arena: arenaRes.data,
            courts: courtsRes.data ?? [],
          }),
          { status: 200, headers: cors },
        );
      },
    },
  },
});
