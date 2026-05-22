-- Allow public to read active arenas
CREATE POLICY "arenas_public_read" 
ON public.arenas 
FOR SELECT 
USING (active = true);

-- Allow public to read courts of active arenas
CREATE POLICY "courts_public_read" 
ON public.courts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.arenas a 
  WHERE a.id = courts.arena_id AND a.active = true
));

-- Ensure videos public read is consistent (the existing "Videos are viewable by everyone" policy with true is already quite broad, but let's make sure it's reliable)
-- If it already exists, we don't need to do much, but the current "videos_select_with_access" might be conflicting or limiting.
-- Let's check if we should add a more specific one for active arenas too.

CREATE POLICY "videos_public_read_active_arenas" 
ON public.videos 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.arenas a 
  WHERE a.id = videos.arena_id AND a.active = true
));
