
-- 1) Conexão dedicada por arena (apenas superadmin enxerga via RLS na coluna pelo app)
ALTER TABLE public.arenas
  ADD COLUMN IF NOT EXISTS supabase_url text,
  ADD COLUMN IF NOT EXISTS supabase_service_key text;

-- 2) Botões disponíveis por arena
CREATE TABLE IF NOT EXISTS public.arena_buttons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (arena_id, label)
);
ALTER TABLE public.arena_buttons ENABLE ROW LEVEL SECURITY;

CREATE POLICY arena_buttons_select ON public.arena_buttons
  FOR SELECT USING (has_arena_access(auth.uid(), arena_id));
CREATE POLICY arena_buttons_manage ON public.arena_buttons
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'));

-- 3) Câmeras (com botão associado opcional, único por arena)
CREATE TABLE IF NOT EXISTS public.cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL,
  name text NOT NULL,
  rtsp_url text NOT NULL,
  button_id uuid REFERENCES public.arena_buttons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cameras_button_unique
  ON public.cameras(button_id) WHERE button_id IS NOT NULL;

ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY cameras_select ON public.cameras
  FOR SELECT USING (has_arena_access(auth.uid(), arena_id));
CREATE POLICY cameras_manage ON public.cameras
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'));

-- 4) Placas Zero Delay
CREATE TABLE IF NOT EXISTS public.zero_delay_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL,
  name text NOT NULL,
  serial text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (arena_id, serial)
);
ALTER TABLE public.zero_delay_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY boards_select ON public.zero_delay_boards
  FOR SELECT USING (has_arena_access(auth.uid(), arena_id));
CREATE POLICY boards_manage ON public.zero_delay_boards
  FOR ALL USING (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'))
  WITH CHECK (is_arena_admin(auth.uid(), arena_id) OR has_role(auth.uid(),'superadmin'));
