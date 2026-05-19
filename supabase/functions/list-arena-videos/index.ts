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
    const { arenaId, bucket, prefix } = await req.json()
    
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
      .select('supabase_url, supabase_anon_key')
      .eq('id', arenaId)
      .single()

    if (arenaError || !arena) {
      console.error('Error fetching arena:', arenaError)
      throw new Error('Arena not found or keys missing')
    }

    if (!arena.supabase_url || !arena.supabase_anon_key) {
      throw new Error('Arena is missing Supabase credentials')
    }

    // Initialize external Supabase client
    const externalClient = createClient(arena.supabase_url, arena.supabase_anon_key)

    const bucketName = bucket || 'replays'
    const folder = prefix || ''

    // List files
    const { data: files, error: listError } = await externalClient.storage
      .from(bucketName)
      .list(folder || undefined, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (listError) {
      console.error('Error listing storage:', listError)
      throw listError
    }

    // Map files to include public URLs
    const videos = (files ?? [])
      .filter((f) => f.name && !f.name.endsWith('/') && /\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name))
      .map((f) => {
        const fullPath = folder ? `${folder}/${f.name}` : f.name
        const { data: { publicUrl } } = externalClient.storage.from(bucketName).getPublicUrl(fullPath)
        
        return {
          name: f.name,
          url: publicUrl,
          createdAt: f.created_at || f.updated_at || null,
          size: f.metadata?.size || null,
        }
      })

    return new Response(JSON.stringify({ videos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
