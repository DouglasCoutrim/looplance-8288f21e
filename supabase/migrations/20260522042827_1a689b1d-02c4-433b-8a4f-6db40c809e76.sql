-- Enable RLS for quadras
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;

-- Add policies for quadras
DROP POLICY IF EXISTS "Todos podem ver quadras" ON public.quadras;
CREATE POLICY "Todos podem ver quadras" 
ON public.quadras 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Admins podem gerenciar quadras da arena" ON public.quadras;
CREATE POLICY "Admins podem gerenciar quadras da arena" 
ON public.quadras 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (
            role = 'superadmin'::app_role 
            OR (role = 'admin_arena'::app_role AND arena_id = quadras.arena_id)
        )
    )
);

-- Update user_roles select policy
DROP POLICY IF EXISTS "roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "roles_select_own_or_admin" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'superadmin'::app_role) 
    OR is_arena_admin(auth.uid(), arena_id)
);
