-- Fix policies for placas_zero_delay
DROP POLICY IF EXISTS "Admins podem gerenciar placas da arena" ON public.placas_zero_delay;
CREATE POLICY "Admins podem gerenciar placas da arena" 
ON public.placas_zero_delay 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (
            role = 'superadmin'::app_role 
            OR (role = 'admin_arena'::app_role AND arena_id = placas_zero_delay.arena_id)
        )
    )
);

-- Fix policies for botoes_zero_delay
DROP POLICY IF EXISTS "Admins podem gerenciar botoes da arena" ON public.botoes_zero_delay;
CREATE POLICY "Admins podem gerenciar botoes da arena" 
ON public.botoes_zero_delay 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.placas_zero_delay p
        JOIN public.user_roles ur ON (
            ur.user_id = auth.uid() 
            AND (
                ur.role = 'superadmin'::app_role 
                OR (ur.role = 'admin_arena'::app_role AND ur.arena_id = p.arena_id)
            )
        )
        WHERE p.id = botoes_zero_delay.placa_id
    )
);

-- Fix policies for cameras
DROP POLICY IF EXISTS "Admins podem gerenciar cameras da arena" ON public.cameras;
CREATE POLICY "Admins podem gerenciar cameras da arena" 
ON public.cameras 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (
            role = 'superadmin'::app_role 
            OR (role = 'admin_arena'::app_role AND arena_id = cameras.arena_id)
        )
    )
);
