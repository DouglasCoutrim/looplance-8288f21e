-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.replays CASCADE;
DROP TABLE IF EXISTS public.quadras CASCADE;
DROP TABLE IF EXISTS public.arenas CASCADE;

-- Create arenas table
CREATE TABLE public.arenas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quadras table
CREATE TABLE public.quadras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create replays table
CREATE TABLE public.replays (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

-- Create public read policies
CREATE POLICY "Arenas are viewable by everyone" ON public.arenas FOR SELECT USING (true);
CREATE POLICY "Quadras are viewable by everyone" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "Replays are viewable by everyone" ON public.replays FOR SELECT USING (true);

-- Insert seed data
INSERT INTO public.arenas (id, nome) VALUES 
('1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', 'Arena Central'),
('2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b', 'Arena Tech');

INSERT INTO public.quadras (id, arena_id, nome) VALUES 
('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', 'Quadra A'),
('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', 'Quadra B'),
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b', 'Quadra Principal');

-- Add some dummy replays (using placeholder videos)
INSERT INTO public.replays (quadra_id, video_url, created_at) VALUES 
('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'https://vjs.zencdn.net/v/oceans.mp4', now() - interval '1 hour'),
('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'https://vjs.zencdn.net/v/oceans.mp4', now() - interval '2 hours'),
('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'https://vjs.zencdn.net/v/oceans.mp4', now() - interval '30 minutes');
