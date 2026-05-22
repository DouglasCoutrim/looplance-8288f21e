-- Drop and recreate the trigger function without videos_bucket
CREATE OR REPLACE FUNCTION public.bump_cfg_arenas_self()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.retention_days IS DISTINCT FROM OLD.retention_days
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.config_version := COALESCE(OLD.config_version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-apply the trigger (DROP then CREATE just in case)
DROP TRIGGER IF EXISTS trg_bump_cfg_arenas_self ON public.arenas;
CREATE TRIGGER trg_bump_cfg_arenas_self
BEFORE UPDATE ON public.arenas
FOR EACH ROW
EXECUTE FUNCTION public.bump_cfg_arenas_self();

-- Ensure videos_bucket is gone from the table if it was somehow present in cache but not in table
-- or just to be absolutely sure we don't reference it anymore.
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arenas' AND column_name = 'videos_bucket') THEN
        ALTER TABLE public.arenas DROP COLUMN videos_bucket;
    END IF;
END $$;
