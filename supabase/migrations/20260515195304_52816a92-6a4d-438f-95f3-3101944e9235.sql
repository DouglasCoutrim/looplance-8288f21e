
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS videos_bucket text DEFAULT 'replays',
  ADD COLUMN IF NOT EXISTS retention_days integer;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_super ON public.app_settings;
CREATE POLICY app_settings_super ON public.app_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

INSERT INTO public.app_settings(key, value)
VALUES ('default_retention_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;
