-- Many-to-many: courts <-> cameras (vincular câmeras a quadras)
CREATE TABLE IF NOT EXISTS public.court_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL,
  camera_id uuid NOT NULL,
  arena_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (court_id, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_court_cameras_court ON public.court_cameras(court_id);
CREATE INDEX IF NOT EXISTS idx_court_cameras_camera ON public.court_cameras(camera_id);
CREATE INDEX IF NOT EXISTS idx_court_cameras_arena ON public.court_cameras(arena_id);

ALTER TABLE public.court_cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "court_cameras_select"
  ON public.court_cameras FOR SELECT
  USING (public.has_arena_access(auth.uid(), arena_id));

CREATE POLICY "court_cameras_manage"
  ON public.court_cameras FOR ALL
  USING (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role));