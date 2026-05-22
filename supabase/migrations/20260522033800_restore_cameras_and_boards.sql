-- Migration: Restore cameras, zero-delay boards and mappings

-- 1. Create zero_delay_boards table
CREATE TABLE IF NOT EXISTS public.zero_delay_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL,
  serial text NOT NULL,
  model text NOT NULL DEFAULT 'ARC-968',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (arena_id, serial)
);

-- Enable RLS for zero_delay_boards
ALTER TABLE public.zero_delay_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boards_select ON public.zero_delay_boards;
CREATE POLICY boards_select ON public.zero_delay_boards
  FOR SELECT USING (has_arena_access(auth.uid(), arena_id));

DROP POLICY IF EXISTS boards_manage ON public.zero_delay_boards;
CREATE POLICY boards_manage ON public.zero_delay_boards
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 2. Create cameras table
CREATE TABLE IF NOT EXISTS public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL,
  rtsp_url text NOT NULL,
  button_id uuid, -- Reference added later to avoid dependency cycles
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for cameras
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cameras_select ON public.cameras;
CREATE POLICY cameras_select ON public.cameras
  FOR SELECT USING (has_arena_access(auth.uid(), arena_id));

DROP POLICY IF EXISTS cameras_manage ON public.cameras;
CREATE POLICY cameras_manage ON public.cameras
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 3. Modify arena_buttons to add columns
ALTER TABLE public.arena_buttons
  ADD COLUMN IF NOT EXISTS board_id UUID,
  ADD COLUMN IF NOT EXISTS button_number INT,
  ADD COLUMN IF NOT EXISTS hardware_pin TEXT,
  ADD COLUMN IF NOT EXISTS camera_id UUID;

-- Add constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_buttons_board_id_fkey') THEN
    ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.zero_delay_boards(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_buttons_camera_id_fkey') THEN
    ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS arena_buttons_board_number_uidx
  ON public.arena_buttons (board_id, button_number) WHERE board_id IS NOT NULL;

-- 4. Add constraint to cameras
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cameras_button_id_fkey') THEN
    ALTER TABLE public.cameras ADD CONSTRAINT cameras_button_id_fkey FOREIGN KEY (button_id) REFERENCES public.arena_buttons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Unique constraint for button on cameras
CREATE UNIQUE INDEX IF NOT EXISTS cameras_button_unique
  ON public.cameras(button_id) WHERE button_id IS NOT NULL;

-- 5. Create court_cameras table
CREATE TABLE IF NOT EXISTS public.court_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id uuid NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  camera_id uuid NOT NULL REFERENCES public.cameras(id) ON DELETE CASCADE,
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (court_id, camera_id)
);

-- Enable RLS for court_cameras
ALTER TABLE public.court_cameras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_cameras_select" ON public.court_cameras;
CREATE POLICY "court_cameras_select"
  ON public.court_cameras FOR SELECT
  USING (public.has_arena_access(auth.uid(), arena_id));

DROP POLICY IF EXISTS "court_cameras_manage" ON public.court_cameras;
CREATE POLICY "court_cameras_manage"
  ON public.court_cameras FOR ALL
  USING (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role));

-- 6. Trigger to generate buttons automatically for boards
CREATE OR REPLACE FUNCTION public.generate_arc968_buttons()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pins TEXT[] := ARRAY['K1','K2','K3','K4','L2','R2','L1','R1','SE','ST','K11','K12'];
  i INT;
BEGIN
  IF NEW.model = 'ARC-968' THEN
    FOR i IN 1..12 LOOP
      INSERT INTO public.arena_buttons (arena_id, board_id, button_number, hardware_pin, label, status)
      VALUES (NEW.arena_id, NEW.id, i, pins[i],
        'Botão ' || LPAD(i::text, 2, '0') || ' (' || pins[i] || ')', 'idle')
      ON CONFLICT (arena_id, label) DO UPDATE
      SET board_id = EXCLUDED.board_id,
          button_number = EXCLUDED.button_number,
          hardware_pin = EXCLUDED.hardware_pin;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_arc968 ON public.zero_delay_boards;
CREATE TRIGGER trigger_generate_arc968
AFTER INSERT ON public.zero_delay_boards
FOR EACH ROW EXECUTE FUNCTION public.generate_arc968_buttons();

-- 7. Trigger to sync button <-> camera mapping
CREATE OR REPLACE FUNCTION public.sync_button_camera()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.button_id IS NOT NULL THEN
      UPDATE public.arena_buttons SET camera_id = NULL WHERE id = OLD.button_id AND camera_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.button_id IS DISTINCT FROM NEW.button_id AND OLD.button_id IS NOT NULL THEN
    UPDATE public.arena_buttons SET camera_id = NULL WHERE id = OLD.button_id AND camera_id = OLD.id;
  END IF;
  IF NEW.button_id IS NOT NULL THEN
    UPDATE public.arena_buttons SET camera_id = NEW.id WHERE id = NEW.button_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_button_camera ON public.cameras;
CREATE TRIGGER trigger_sync_button_camera
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW EXECUTE FUNCTION public.sync_button_camera();

-- 8. Configuration version bump triggers
DROP TRIGGER IF EXISTS trg_bump_cfg_cameras ON public.cameras;
CREATE TRIGGER trg_bump_cfg_cameras
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_court_cameras ON public.court_cameras;
CREATE TRIGGER trg_bump_cfg_court_cameras
AFTER INSERT OR UPDATE OR DELETE ON public.court_cameras
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

DROP TRIGGER IF EXISTS trg_bump_cfg_zero_delay_boards ON public.zero_delay_boards;
CREATE TRIGGER trg_bump_cfg_zero_delay_boards
AFTER INSERT OR UPDATE OR DELETE ON public.zero_delay_boards
FOR EACH ROW EXECUTE FUNCTION public.bump_arena_config_version();

-- 9. View for agent mapping
CREATE OR REPLACE VIEW public.arena_button_camera_map AS
SELECT
  ab.arena_id,
  ab.hardware_pin AS pino,
  ab.camera_id,
  c.rtsp_url AS rtsp,
  c.name AS camera_name,
  ab.label AS button_label,
  ab.button_number
FROM public.arena_buttons ab
LEFT JOIN public.cameras c ON c.id = ab.camera_id
WHERE ab.hardware_pin IS NOT NULL;

ALTER VIEW public.arena_button_camera_map SET (security_invoker = true);

GRANT SELECT ON public.arena_button_camera_map TO authenticated;
