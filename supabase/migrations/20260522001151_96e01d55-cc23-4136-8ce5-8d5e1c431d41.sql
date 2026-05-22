-- Drop legacy tables and related objects
DROP TABLE IF EXISTS public.court_cameras CASCADE;
DROP TABLE IF EXISTS public.cameras CASCADE;
DROP TABLE IF EXISTS public.arena_button_camera_map CASCADE;
DROP TABLE IF EXISTS public.zero_delay_boards CASCADE;
DROP TABLE IF EXISTS public.arena_buttons CASCADE;

-- Add rtsp_url to courts (quadras)
ALTER TABLE public.courts ADD COLUMN IF NOT EXISTS rtsp_url TEXT;

-- Create new arena_buttons table for triggers
CREATE TABLE public.arena_buttons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    quadra_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'disparado',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for arena_buttons
ALTER TABLE public.arena_buttons ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for simulation) or restrict to authenticated users
CREATE POLICY "Enable insert for authenticated users only" ON public.arena_buttons
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow select for Realtime
CREATE POLICY "Enable select for authenticated users" ON public.arena_buttons
    FOR SELECT USING (auth.role() = 'authenticated');

-- Enable Realtime for arena_buttons
ALTER PUBLICATION supabase_realtime ADD TABLE public.arena_buttons;
