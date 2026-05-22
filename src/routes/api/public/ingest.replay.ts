import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createHash } from 'crypto';

export const Route = createFileRoute('/api/public/ingest/replay')({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Arena-Id',
          },
        }),

      POST: async ({ request }) => {
        const cors = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        };
        const fail = (status: number, error: string) =>
          new Response(JSON.stringify({ error }), { status, headers: cors });

        // 1) Auth: Bearer token
        const auth = request.headers.get('authorization') || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        if (!token || token.length < 16 || token.length > 200) {
          return fail(401, 'Missing or invalid bearer token');
        }
        const tokenHash = createHash('sha256').update(token).digest('hex');

        // 2) Parse multipart
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return fail(400, 'Expected multipart/form-data');
        }

        const arenaId = String(form.get('arena_id') || '').trim();
        const courtId = (form.get('court_id') ? String(form.get('court_id')) : '').trim() || null;
        const file = form.get('file');

        if (!/^[0-9a-f-]{36}$/i.test(arenaId)) return fail(400, 'Invalid arena_id');
        if (!(file instanceof File)) return fail(400, 'Missing file');
        if (file.size <= 0 || file.size > 500 * 1024 * 1024) return fail(400, 'File too large (max 500MB)');
        const allowedMime = ['video/mp4', 'video/quicktime', 'video/webm'];
        if (!allowedMime.includes(file.type)) return fail(400, 'Unsupported file type');

        // 3) Validate token against arena
        const { data: tokenRow, error: tokenErr } = await supabaseAdmin
          .from('arena_ingest_tokens')
          .select('id, arena_id, revoked_at')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (tokenErr || !tokenRow || tokenRow.revoked_at || tokenRow.arena_id !== arenaId) {
          return fail(401, 'Invalid token for this arena');
        }

        // 4) Optional: validate court belongs to arena
        if (courtId) {
          const { data: court } = await supabaseAdmin
            .from('courts' as any)
            .select('id')
            .eq('id', courtId)
            .eq('arena_id', arenaId)
            .maybeSingle();
          if (!court) return fail(400, 'court_id does not belong to arena');
        }

        // 5) Upload to storage (bucket: arena-videos)
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const objectPath = `${arenaId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const bytes = new Uint8Array(await file.arrayBuffer());

        const { error: upErr } = await supabaseAdmin.storage
          .from('arena-videos')
          .upload(objectPath, bytes, { contentType: file.type, upsert: false });
        if (upErr) return fail(500, `Upload failed: ${upErr.message}`);

        const { data: pub } = supabaseAdmin.storage.from('arena-videos').getPublicUrl(objectPath);
        const videoUrl = pub.publicUrl;

        // 6) Insert video row (into replays table)
        const { data: video, error: insErr } = await supabaseAdmin
          .from('replays' as any)
          .insert({
            arena_id: arenaId,
            court_id: courtId,
            video_url: videoUrl,
          })
          .select('id')
          .single();

        if (insErr) {
          await supabaseAdmin.storage.from('arena-videos').remove([objectPath]);
          return fail(500, `DB insert failed: ${insErr.message}`);
        }

        // 7) Touch token last_used_at
        await supabaseAdmin
          .from('arena_ingest_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', tokenRow.id);

        return new Response(
          JSON.stringify({
            ok: true,
            video_id: (video as any).id,
            video_url: videoUrl,
            path: objectPath,
          }),
          { status: 201, headers: cors },
        );
      },
    },
  },
});
