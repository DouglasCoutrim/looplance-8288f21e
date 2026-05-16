-- Add agent webhook fields and config version to arenas
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS agent_webhook_url text,
  ADD COLUMN IF NOT EXISTS agent_webhook_secret text,
  ADD COLUMN IF NOT EXISTS config_version bigint NOT NULL DEFAULT 1;

-- Function to bump config_version on dependent table changes
CREATE OR REPLACE FUNCTION public.bump_arena_config_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_arena uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_arena := OLD.arena_id;
  ELSE
    target_arena := NEW.arena_id;
  END IF;

  IF target_arena IS NOT NULL THEN
    UPDATE public.arenas
       SET config_version = config_version + 1
     WHERE id = target_arena;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to bump own config_version when relevant arena columns change
CREATE OR REPLACE FUNCTION public.bump_self_arena_config_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.videos_bucket IS DISTINCT FROM OLD.videos_bucket
     OR NEW.retention_days IS DISTINCT FROM OLD.retention_days
     OR NEW.supabase_url IS DISTINCT FROM OLD.supabase_url
     OR NEW.supabase_anon_key IS DISTINCT FROM OLD.supabase_anon_key
     OR NEW.supabase_service_key IS DISTINCT FROM OLD.supabase_service_key
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.config_version := COALESCE(OLD.config_version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_cfg_courts ON public.courts;
CREATE TRIGGER trg_bump_cfg_courts
AFTER INSERT OR UPDATE OR DELETE ON public.courts
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_cameras ON public.cameras;
CREATE TRIGGER trg_bump_cfg_cameras
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_court_cameras ON public.court_cameras;
CREATE TRIGGER trg_bump_cfg_court_cameras
AFTER INSERT OR UPDATE OR DELETE ON public.court_cameras
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_arena_buttons ON public.arena_buttons;
CREATE TRIGGER trg_bump_cfg_arena_buttons
AFTER INSERT OR UPDATE OR DELETE ON public.arena_buttons
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_zero_delay_boards ON public.zero_delay_boards;
CREATE TRIGGER trg_bump_cfg_zero_delay_boards
AFTER INSERT OR UPDATE OR DELETE ON public.zero_delay_boards
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_arenas_self ON public.arenas;
CREATE TRIGGER trg_bump_cfg_arenas_self
BEFORE UPDATE ON public.arenas
FOR EACH ROW EXECUTE FUNCTION public.bump_self_arena_config_version();