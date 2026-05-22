ALTER TABLE public.arena_buttons RENAME COLUMN quadra_id TO court_id;
ALTER TABLE public.arena_buttons DROP CONSTRAINT IF EXISTS arena_buttons_quadra_id_fkey;
ALTER TABLE public.arena_buttons ADD CONSTRAINT arena_buttons_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;
