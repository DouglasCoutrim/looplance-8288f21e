DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_buttons_arena_id_fkey') THEN
    ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cameras_arena_id_fkey') THEN
    ALTER TABLE public.cameras ADD CONSTRAINT cameras_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='courts_arena_id_fkey') THEN
    ALTER TABLE public.courts ADD CONSTRAINT courts_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='videos_arena_id_fkey') THEN
    ALTER TABLE public.videos ADD CONSTRAINT videos_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='zero_delay_boards_arena_id_fkey') THEN
    ALTER TABLE public.zero_delay_boards ADD CONSTRAINT zero_delay_boards_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_roles_arena_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_arena_id_fkey FOREIGN KEY (arena_id) REFERENCES public.arenas(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role, arena_id)
  VALUES (NEW.id, 'player', NULL)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_arena_uidx
  ON public.user_roles (user_id, role, COALESCE(arena_id, '00000000-0000-0000-0000-000000000000'::uuid));

INSERT INTO public.user_roles (user_id, role, arena_id)
SELECT u.id, 'player', NULL FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

ALTER TABLE public.zero_delay_boards
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'ARC-968';

ALTER TABLE public.arena_buttons
  ADD COLUMN IF NOT EXISTS board_id UUID,
  ADD COLUMN IF NOT EXISTS button_number INT,
  ADD COLUMN IF NOT EXISTS hardware_pin TEXT,
  ADD COLUMN IF NOT EXISTS camera_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_buttons_board_id_fkey') THEN
    ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.zero_delay_boards(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='arena_buttons_camera_id_fkey') THEN
    ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_camera_id_fkey FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS arena_buttons_board_number_uidx
  ON public.arena_buttons (board_id, button_number) WHERE board_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_arc968_buttons()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pins TEXT[] := ARRAY['K1','K2','K3','K4','L2','R2','L1','R1','SE','ST','K11','K12'];
  i INT;
BEGIN
  IF NEW.model = 'ARC-968' THEN
    FOR i IN 1..12 LOOP
      INSERT INTO public.arena_buttons (arena_id, board_id, button_number, hardware_pin, label)
      VALUES (NEW.arena_id, NEW.id, i, pins[i],
        'Botão ' || LPAD(i::text, 2, '0') || ' (' || pins[i] || ')');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_arc968 ON public.zero_delay_boards;
CREATE TRIGGER trigger_generate_arc968
AFTER INSERT ON public.zero_delay_boards
FOR EACH ROW EXECUTE FUNCTION public.generate_arc968_buttons();

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

UPDATE public.arena_buttons ab
SET camera_id = c.id
FROM public.cameras c
WHERE c.button_id = ab.id AND ab.camera_id IS DISTINCT FROM c.id;