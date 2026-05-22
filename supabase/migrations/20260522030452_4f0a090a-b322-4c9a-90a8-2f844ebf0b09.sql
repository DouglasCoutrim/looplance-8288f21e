-- Create courts table
CREATE TABLE IF NOT EXISTS public.courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- Policies for courts
CREATE POLICY "courts_select_public" ON public.courts FOR SELECT USING (true);
CREATE POLICY "courts_admin_all" ON public.courts FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() 
        AND (role = 'superadmin' OR (role = 'admin_arena' AND arena_id = courts.arena_id))
    )
);

-- Update replays table
ALTER TABLE public.replays RENAME COLUMN quadra_id TO court_id;
ALTER TABLE public.replays DROP CONSTRAINT IF EXISTS replays_quadra_id_fkey;
ALTER TABLE public.replays ADD CONSTRAINT replays_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE SET NULL;

-- Drop quadras if empty and exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quadras') THEN
        IF (SELECT count(*) FROM public.quadras) = 0 THEN
            DROP TABLE public.quadras CASCADE;
        END IF;
    END IF;
END $$;
