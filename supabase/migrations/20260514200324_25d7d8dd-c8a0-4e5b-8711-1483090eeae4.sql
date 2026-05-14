DROP VIEW IF EXISTS public.public_arenas;
CREATE VIEW public.public_arenas
WITH (security_invoker = true) AS
SELECT
  id, slug, name, logo_url, primary_color, active,
  city, state,
  supabase_url, supabase_anon_key
FROM public.arenas
WHERE active = true;

GRANT SELECT ON public.public_arenas TO anon, authenticated;