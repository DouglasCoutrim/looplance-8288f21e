-- Update profiles select policy to be searchable by all authenticated users
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);
