-- Allow any signed-in user to view courts and videos for active arenas.
DROP POLICY IF EXISTS courts_select_authenticated_active_arenas ON public.courts;
CREATE POLICY courts_select_authenticated_active_arenas
ON public.courts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.arenas a
    WHERE a.id = courts.arena_id
      AND a.active = true
  )
);

DROP POLICY IF EXISTS videos_select_authenticated_active_arenas ON public.videos;
CREATE POLICY videos_select_authenticated_active_arenas
ON public.videos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.arenas a
    WHERE a.id = videos.arena_id
      AND a.active = true
  )
);

-- Ensure central replay feed stays in sync with uploaded videos.
DROP TRIGGER IF EXISTS videos_sync_global_replay ON public.videos;
CREATE TRIGGER videos_sync_global_replay
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.sync_global_replay();