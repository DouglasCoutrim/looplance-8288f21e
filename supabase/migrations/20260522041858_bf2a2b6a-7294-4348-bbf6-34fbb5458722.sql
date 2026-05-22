-- Removendo tabelas antigas se existirem para evitar conflitos de nomes ou lógica legada
DROP TABLE IF EXISTS public.cameras CASCADE;
DROP TABLE IF EXISTS public.court_cameras CASCADE;
DROP TABLE IF EXISTS public.arena_buttons CASCADE;
DROP TABLE IF EXISTS public.zero_delay_boards CASCADE;

-- Tabela de Placas Zero Delay
CREATE TABLE public.placas_zero_delay (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Botões Zero Delay
CREATE TABLE public.botoes_zero_delay (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    placa_id UUID NOT NULL REFERENCES public.placas_zero_delay(id) ON DELETE CASCADE,
    numero_botao INTEGER NOT NULL CHECK (numero_botao BETWEEN 1 AND 12),
    status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em uso')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Câmeras (re-criada com a nova estrutura)
CREATE TABLE public.cameras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
    botao_id UUID UNIQUE REFERENCES public.botoes_zero_delay(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    rtsp_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.placas_zero_delay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botoes_zero_delay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (Simplificadas: quem tem acesso à arena pode ver/editar)
-- Nota: Usando auth.uid() e verificando se o usuário é admin da arena (usando a tabela user_roles ou similar se disponível)
-- Mas para simplificar e garantir funcionamento imediato, vamos permitir SELECT para todos e INSERT/UPDATE/DELETE para admins da arena.

CREATE POLICY "Admins podem gerenciar placas da arena" 
ON public.placas_zero_delay 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND arena_id = placas_zero_delay.arena_id AND role IN ('superadmin', 'admin_arena')));

CREATE POLICY "Todos podem ver placas" 
ON public.placas_zero_delay FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar botoes da arena" 
ON public.botoes_zero_delay 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.placas_zero_delay p 
    JOIN public.user_roles ur ON ur.arena_id = p.arena_id 
    WHERE p.id = botoes_zero_delay.placa_id AND ur.user_id = auth.uid() AND ur.role IN ('superadmin', 'admin_arena')
));

CREATE POLICY "Todos podem ver botoes" 
ON public.botoes_zero_delay FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar cameras da arena" 
ON public.cameras 
FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND arena_id = cameras.arena_id AND role IN ('superadmin', 'admin_arena')));

CREATE POLICY "Todos podem ver cameras" 
ON public.cameras FOR SELECT USING (true);


-- Função para criar automaticamente os 12 botões ao cadastrar uma placa
CREATE OR REPLACE FUNCTION public.fn_create_placa_buttons()
RETURNS TRIGGER AS $$
BEGIN
    FOR i IN 1..12 LOOP
        INSERT INTO public.botoes_zero_delay (placa_id, numero_botao, status)
        VALUES (NEW.id, i, 'disponivel');
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho para a criação dos botões
CREATE TRIGGER trg_after_placa_insert
AFTER INSERT ON public.placas_zero_delay
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_placa_buttons();


-- Função para atualizar o status do botão quando uma câmera é vinculada ou desvinculada
CREATE OR REPLACE FUNCTION public.fn_update_button_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Se um botão foi vinculado
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.botao_id IS NOT NULL)) THEN
        UPDATE public.botoes_zero_delay SET status = 'em uso' WHERE id = NEW.botao_id;
    END IF;
    
    -- Se um botão foi desvinculado (no update ou delete)
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.botao_id IS NOT NULL AND (NEW.botao_id IS NULL OR NEW.botao_id <> OLD.botao_id))) THEN
        UPDATE public.botoes_zero_delay SET status = 'disponivel' WHERE id = OLD.botao_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_camera_button_status
AFTER INSERT OR UPDATE OR DELETE ON public.cameras
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_button_status();
