-- 1. Remover tabelas obsoletas
DROP TABLE IF EXISTS public.replay_jobs CASCADE;

-- 2. Limpar a tabela de replays (atualmente chamada 'videos')
ALTER TABLE public.videos 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS storage_path,
DROP COLUMN IF EXISTS thumbnail_url,
DROP COLUMN IF EXISTS processing_id;

-- 3. Remover colunas obsoletas da tabela arenas
-- Primeiro removemos a view que depende delas
DROP VIEW IF EXISTS public.public_arenas;

ALTER TABLE public.arenas 
DROP COLUMN IF EXISTS supabase_url,
DROP COLUMN IF EXISTS supabase_anon_key,
DROP COLUMN IF EXISTS supabase_service_key,
DROP COLUMN IF EXISTS videos_bucket,
DROP COLUMN IF EXISTS agent_webhook_url,
DROP COLUMN IF EXISTS agent_webhook_secret;

-- 4. Recriar a View public_arenas simplificada
CREATE OR REPLACE VIEW public.public_arenas AS
SELECT 
    id, 
    name, 
    slug, 
    logo_url, 
    primary_color, 
    city, 
    state,
    active
FROM public.arenas;

-- 5. Configurar RLS na tabela videos (nossos replays)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos are viewable by everyone" ON public.videos;
CREATE POLICY "Videos are viewable by everyone" 
ON public.videos FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admins can insert videos" ON public.videos;
CREATE POLICY "Admins can insert videos" 
ON public.videos FOR INSERT 
WITH CHECK (true);
