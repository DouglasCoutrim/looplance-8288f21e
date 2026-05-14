-- 1. City/State on arenas
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Replay jobs (MVP — só registra o pedido, processamento externo)
CREATE TABLE IF NOT EXISTS public.replay_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  arena_id UUID NOT NULL,
  source_video_id UUID,
  source_video_url TEXT,
  timestamp_inicio NUMERIC NOT NULL DEFAULT 0,
  duracao_segundos INT NOT NULL DEFAULT 30,
  crop_x NUMERIC NOT NULL DEFAULT 0,
  crop_y NUMERIC NOT NULL DEFAULT 0,
  crop_w NUMERIC NOT NULL DEFAULT 1,
  crop_h NUMERIC NOT NULL DEFAULT 1,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'pending',
  output_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.replay_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replay_jobs_select_own_or_admin"
  ON public.replay_jobs FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_arena_admin(auth.uid(), arena_id)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );

CREATE POLICY "replay_jobs_insert_own"
  ON public.replay_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "replay_jobs_update_admin"
  ON public.replay_jobs FOR UPDATE
  USING (
    public.is_arena_admin(auth.uid(), arena_id)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );

CREATE POLICY "replay_jobs_delete_own_or_admin"
  ON public.replay_jobs FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_arena_admin(auth.uid(), arena_id)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS idx_replay_jobs_user ON public.replay_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_jobs_arena ON public.replay_jobs(arena_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replay_jobs_status ON public.replay_jobs(status);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_replay_jobs_touch ON public.replay_jobs;
CREATE TRIGGER trg_replay_jobs_touch
  BEFORE UPDATE ON public.replay_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Favoritos
CREATE TABLE IF NOT EXISTS public.favorite_arenas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  arena_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, arena_id)
);

ALTER TABLE public.favorite_arenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own"
  ON public.favorite_arenas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own"
  ON public.favorite_arenas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own"
  ON public.favorite_arenas FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorite_arenas(user_id);

-- 4. Expose city/state on the public_arenas view
DROP VIEW IF EXISTS public.public_arenas;
CREATE VIEW public.public_arenas AS
SELECT
  id, slug, name, logo_url, primary_color, active,
  city, state,
  supabase_url, supabase_anon_key
FROM public.arenas
WHERE active = true;

GRANT SELECT ON public.public_arenas TO anon, authenticated;