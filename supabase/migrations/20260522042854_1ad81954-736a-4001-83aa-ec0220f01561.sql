-- Update profiles select policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
    auth.uid() = id 
    OR has_role(auth.uid(), 'superadmin'::app_role) 
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = public.profiles.id 
        AND is_arena_admin(auth.uid(), ur.arena_id)
    )
);
