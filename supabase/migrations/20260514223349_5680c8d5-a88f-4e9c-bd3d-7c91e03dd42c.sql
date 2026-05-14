
ALTER TABLE public.replay_jobs
  ADD COLUMN IF NOT EXISTS start_time numeric,
  ADD COLUMN IF NOT EXISTS end_time numeric,
  ADD COLUMN IF NOT EXISTS coords_json jsonb;

-- Backfill from existing columns
UPDATE public.replay_jobs
SET
  start_time = COALESCE(start_time, timestamp_inicio),
  end_time = COALESCE(end_time, timestamp_inicio + duracao_segundos),
  coords_json = COALESCE(coords_json, jsonb_build_object('x', crop_x, 'y', crop_y, 'w', crop_w, 'h', crop_h))
WHERE start_time IS NULL OR end_time IS NULL OR coords_json IS NULL;
