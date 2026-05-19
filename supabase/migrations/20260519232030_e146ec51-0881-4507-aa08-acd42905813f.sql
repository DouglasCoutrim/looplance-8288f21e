
-- 1) Stop exposing sensitive arena columns to public.
--    Switch public_arenas view to run with definer perms and only expose safe columns.
ALTER VIEW public.public_arenas SET (security_invoker = false);
GRANT SELECT ON public.public_arenas TO anon, authenticated;

-- Drop the over-broad public SELECT policy on arenas.
DROP POLICY IF EXISTS "arenas_public_basic" ON public.arenas;

-- 2) Tighten has_arena_access to require an actual user_roles entry
--    for that arena (admin or player) or superadmin.
CREATE OR REPLACE FUNCTION public.has_arena_access(_user_id uuid, _arena_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.role() = 'authenticated'
     AND EXISTS (
       SELECT 1 FROM public.arenas a
       WHERE a.id = _arena_id AND a.active = true
     )
     AND (
       public.has_role(_user_id, 'superadmin'::app_role)
       OR EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = _user_id
           AND ur.arena_id = _arena_id
           AND ur.role IN ('admin_arena'::app_role, 'player'::app_role)
       )
     );
$$;

-- 3) Storage: restrict mutations on arena buckets to arena admins / superadmin.
-- Convention: first folder segment is the arena_id (uuid).
DROP POLICY IF EXISTS "logos_auth_write"   ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update"  ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete"  ON storage.objects;
DROP POLICY IF EXISTS "videos_auth_write"  ON storage.objects;
DROP POLICY IF EXISTS "videos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "videos_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "sponsors_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "sponsors_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "sponsors_auth_delete" ON storage.objects;

CREATE POLICY "logos_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'arena-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "logos_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'arena-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "logos_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'arena-logos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "videos_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'arena-videos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "videos_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'arena-videos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "videos_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'arena-videos'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "sponsors_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sponsors'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "sponsors_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'sponsors'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
CREATE POLICY "sponsors_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sponsors'
  AND (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  AND (
    public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.is_arena_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
