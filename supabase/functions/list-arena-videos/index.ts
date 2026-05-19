import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { arenaId, type, bucket, prefix } = await req.json()
    
    if (!arenaId) {
      throw new Error('arenaId is required')
    }

    // Initialize central Supabase client with service role to get arena keys
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch arena credentials
    const { data: arena, error: arenaError } = await supabaseAdmin
      .from('arenas')
      .select('supabase_url, supabase_anon_key, supabase_service_key')
      .eq('id', arenaId)
      .single()

    if (arenaError || !arena) {
      console.error('Error fetching arena:', arenaError)
      throw new Error('Arena not found or keys missing')
    }

    if (!arena.supabase_url || (!arena.supabase_anon_key && !arena.supabase_service_key)) {
      throw new Error('Arena is missing Supabase credentials')
    }

    // Initialize external Supabase client - prefer service key if available
    const externalClient = createClient(
      arena.supabase_url, 
      arena.supabase_service_key || arena.supabase_anon_key
    )

    if (type === 'videos') {
      // Query videos table
      const sel = "id,video_url,thumbnail_url,created_at,court_id";
      
      try {
        // Try with arena_id filter first
        let { data, error } = await externalClient
          .from("videos")
          .select(sel)
          .eq("arena_id", arenaId)
          .order("created_at", { ascending: false })
          .limit(500);

        // Fallback if error or no data (legacy schema)
        if (error || !(data ?? []).length) {
          const fallback = await externalClient
            .from("videos")
            .select(sel)
            .order("created_at", { ascending: false })
            .limit(500);
          
          if (!fallback.error && (fallback.data ?? []).length > 0) {
            data = fallback.data;
          } else {
            // If table doesn't exist or is empty, fall back to listing storage
            if (fallback.error?.message?.includes("Could not find the table") || (fallback.data ?? []).length === 0) {
              return await listFromStorage(externalClient, bucket || 'replays', prefix || '', true);
            }
            throw fallback.error;
          }
        }

        return new Response(JSON.stringify({ videos: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (err) {
        // If anything goes wrong with the table, try storage listing as ultimate fallback
        console.warn('Database query failed, falling back to storage:', err.message);
        return await listFromStorage(externalClient, bucket || 'replays', prefix || '', true);
      }
    } else {
      // Default: type === 'bucket'
      return await listFromStorage(externalClient, bucket || 'replays', prefix || '', false);
    }
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function listFromStorage(client: any, bucketName: string, folder: string, mapToVideoSchema: boolean) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // List files
  const { data: files, error: listError } = await client.storage
    .from(bucketName)
    .list(folder || undefined, {
      limit: 200,
      sortBy: { column: 'created_at', order: 'desc' },
    })

  if (listError) {
    console.error('Error listing storage:', listError)
    throw listError
  }

  const videos = (files ?? [])
    .filter((f) => f.name && !f.name.endsWith('/') && /\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name))
    .map((f) => {
      const fullPath = folder ? `${folder}/${f.name}` : f.name
      const { data: { publicUrl } } = client.storage.from(bucketName).getPublicUrl(fullPath)
      
      const createdAt = f.created_at || f.updated_at || new Date().toISOString()

      if (mapToVideoSchema) {
        // Try to extract court_id/name from filename like "replay_quadra_1_..."
        let courtId = null;
        const courtMatch = f.name.match(/quadra_(\d+)/i) || f.name.match(/court_(\d+)/i);
        if (courtMatch) {
          courtId = courtMatch[1];
        }

        return {
          id: f.name,
          video_url: publicUrl,
          thumbnail_url: null,
          created_at: createdAt,
          court_id: courtId
        }
      }

      return {
        name: f.name,
        url: publicUrl,
        createdAt: createdAt,
        size: f.metadata?.size || null,
      }
    })

  return new Response(JSON.stringify({ videos }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
