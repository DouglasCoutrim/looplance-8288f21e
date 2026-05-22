-- Create replays table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.replays (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    quadra_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
    video_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors on retry
DROP POLICY IF EXISTS "Anyone can view replays" ON public.replays;
DROP POLICY IF EXISTS "Authenticated users can insert replays" ON public.replays;
DROP POLICY IF EXISTS "Users can delete replays if they own the arena" ON public.replays;

-- Create policies
CREATE POLICY "Anyone can view replays" 
ON public.replays 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert replays" 
ON public.replays 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete replays if they own the arena" 
ON public.replays 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.arenas a 
        WHERE a.id = replays.arena_id AND a.owner_id = auth.uid()
    )
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_replays_arena_id ON public.replays(arena_id);
CREATE INDEX IF NOT EXISTS idx_replays_quadra_id ON public.replays(quadra_id);
