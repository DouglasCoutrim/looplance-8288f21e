
CREATE TABLE IF NOT EXISTS public.global_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid UNIQUE,
  arena_id uuid NOT NULL,
  arena_name text NOT NULL,
  arena_slug text NOT NULL,
  arena_primary_color text NOT NULL DEFAULT '#FF6600',
  arena_logo_url text,
  court_id uuid,
  court_name text,
  title text,
  video_url text NOT NULL,
  thumbnail_url text,
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  hora_evento time NOT NULL DEFAULT CURRENT_TIME,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_replays_created_at ON public.global_replays (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_replays_arena_id ON public.global_replays (arena_id);
CREATE INDEX IF NOT EXISTS idx_global_replays_data_evento ON public.global_replays (data_evento DESC);

ALTER TABLE public.global_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_replays_public_read ON public.global_replays;
CREATE POLICY global_replays_public_read ON public.global_replays
  FOR SELECT USING (true);

DROP POLICY IF EXISTS global_replays_admin_manage ON public.global_replays;
CREATE POLICY global_replays_admin_manage ON public.global_replays
  FOR ALL USING (
    public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin')
  ) WITH CHECK (
    public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin')
  );

CREATE OR REPLACE FUNCTION public.sync_global_replay()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  c record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.global_replays WHERE video_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT name, slug, primary_color, logo_url INTO a FROM public.arenas WHERE id = NEW.arena_id;
  IF NEW.court_id IS NOT NULL THEN
    SELECT name INTO c FROM public.courts WHERE id = NEW.court_id;
  END IF;

  INSERT INTO public.global_replays (
    video_id, arena_id, arena_name, arena_slug, arena_primary_color, arena_logo_url,
    court_id, court_name, title, video_url, thumbnail_url,
    data_evento, hora_evento, created_at
  ) VALUES (
    NEW.id, NEW.arena_id,
    COALESCE(a.name, 'Arena'), COALESCE(a.slug, ''), COALESCE(a.primary_color, '#FF6600'), a.logo_url,
    NEW.court_id, c.name, NEW.title, NEW.video_url, NEW.thumbnail_url,
    (NEW.created_at)::date, (NEW.created_at)::time, NEW.created_at
  )
  ON CONFLICT (video_id) DO UPDATE SET
    arena_name = EXCLUDED.arena_name,
    arena_slug = EXCLUDED.arena_slug,
    arena_primary_color = EXCLUDED.arena_primary_color,
    arena_logo_url = EXCLUDED.arena_logo_url,
    court_id = EXCLUDED.court_id,
    court_name = EXCLUDED.court_name,
    title = EXCLUDED.title,
    video_url = EXCLUDED.video_url,
    thumbnail_url = EXCLUDED.thumbnail_url;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_global_replay ON public.videos;
CREATE TRIGGER trg_sync_global_replay
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.sync_global_replay();

-- Backfill existing videos
INSERT INTO public.global_replays (
  video_id, arena_id, arena_name, arena_slug, arena_primary_color, arena_logo_url,
  court_id, court_name, title, video_url, thumbnail_url,
  data_evento, hora_evento, created_at
)
SELECT v.id, v.arena_id,
  COALESCE(a.name,'Arena'), COALESCE(a.slug,''), COALESCE(a.primary_color,'#FF6600'), a.logo_url,
  v.court_id, ct.name, v.title, v.video_url, v.thumbnail_url,
  (v.created_at)::date, (v.created_at)::time, v.created_at
FROM public.videos v
LEFT JOIN public.arenas a ON a.id = v.arena_id
LEFT JOIN public.courts ct ON ct.id = v.court_id
ON CONFLICT (video_id) DO NOTHING;
