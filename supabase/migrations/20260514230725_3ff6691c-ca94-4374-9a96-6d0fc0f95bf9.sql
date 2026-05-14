CREATE OR REPLACE FUNCTION public.has_arena_access(_user_id uuid, _arena_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1
        FROM public.arenas a
        WHERE a.id = _arena_id
          AND a.active = true
      );
$$;