-- Drop old global_replays table
DROP TABLE IF EXISTS public.global_replays CASCADE;

-- Create global_replays view
CREATE VIEW public.global_replays AS
SELECT 
    r.id,
    r.arena_id,
    a.name as arena_name,
    a.slug as arena_slug,
    a.primary_color as arena_primary_color,
    a.logo_url as arena_logo_url,
    r.quadra_id as court_id,
    c.name as court_name,
    NULL as title, -- New simplified approach doesn't use titles
    r.video_url,
    NULL as thumbnail_url,
    (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date::text as data_evento,
    (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::time::text as hora_evento,
    r.created_at
FROM 
    public.replays r
JOIN 
    public.arenas a ON r.arena_id = a.id
LEFT JOIN 
    public.courts c ON r.quadra_id = c.id;

-- Grant access to the view
GRANT SELECT ON public.global_replays TO anon, authenticated;
