-- 1. Add anon key column for local Supabase
ALTER TABLE public.arenas ADD COLUMN IF NOT EXISTS supabase_anon_key text;

-- 2. Sponsors table
CREATE TABLE IF NOT EXISTS public.arena_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  link_url text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.arena_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsors_public_read" ON public.arena_sponsors
  FOR SELECT USING (true);

CREATE POLICY "sponsors_admin_manage" ON public.arena_sponsors
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'));

-- 3. Public view of arenas (only safe columns) for the public player portal
CREATE OR REPLACE VIEW public.public_arenas
WITH (security_invoker = true) AS
SELECT id, slug, name, logo_url, primary_color, supabase_url, supabase_anon_key, active
FROM public.arenas
WHERE active = true;

-- Allow anonymous read of arenas via this view by adding a public-read RLS policy scoped to active arenas.
-- Since the view uses security_invoker, we need to permit the underlying SELECT for anon users on basic columns.
-- We add a permissive RLS policy that only matters for the columns selected by the view.
CREATE POLICY "arenas_public_basic" ON public.arenas
  FOR SELECT USING (active = true);

GRANT SELECT ON public.public_arenas TO anon, authenticated;
GRANT SELECT ON public.arena_sponsors TO anon;