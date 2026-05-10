
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin_arena', 'player');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Arenas
CREATE TABLE public.arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#FF6600',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;

-- Quadras
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- Vídeos
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- user_roles (com arena opcional)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  arena_id UUID REFERENCES public.arenas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, arena_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Funções de segurança
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_arena_admin(_user_id uuid, _arena_id uuid)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin_arena' AND arena_id = _arena_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_arena_player(_user_id uuid, _arena_id uuid)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'player' AND arena_id = _arena_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_arena_access(_user_id uuid, _arena_id uuid)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'superadmin')
      OR public.is_arena_admin(_user_id, _arena_id)
      OR public.is_arena_player(_user_id, _arena_id);
$$;

-- Trigger: criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies: profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policies: user_roles
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "roles_super_all" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "roles_arena_admin_manage_players" ON public.user_roles FOR ALL
  USING (role = 'player' AND public.is_arena_admin(auth.uid(), arena_id))
  WITH CHECK (role = 'player' AND public.is_arena_admin(auth.uid(), arena_id));

-- Policies: arenas
CREATE POLICY "arenas_super_all" ON public.arenas FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "arenas_select_with_access" ON public.arenas FOR SELECT
  USING (public.has_arena_access(auth.uid(), id));
CREATE POLICY "arenas_admin_update" ON public.arenas FOR UPDATE
  USING (public.is_arena_admin(auth.uid(), id));

-- Policies: courts
CREATE POLICY "courts_select_with_access" ON public.courts FOR SELECT
  USING (public.has_arena_access(auth.uid(), arena_id));
CREATE POLICY "courts_admin_manage" ON public.courts FOR ALL
  USING (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'));

-- Policies: videos
CREATE POLICY "videos_select_with_access" ON public.videos FOR SELECT
  USING (public.has_arena_access(auth.uid(), arena_id));
CREATE POLICY "videos_admin_manage" ON public.videos FOR ALL
  USING (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('arena-logos', 'arena-logos', true),
  ('arena-videos', 'arena-videos', true)
ON CONFLICT DO NOTHING;

-- Storage policies (públicos para leitura, autenticados para escrita)
CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'arena-logos');
CREATE POLICY "logos_auth_write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'arena-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "logos_auth_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'arena-logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "logos_auth_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'arena-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "videos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'arena-videos');
CREATE POLICY "videos_auth_write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'arena-videos' AND auth.uid() IS NOT NULL);
CREATE POLICY "videos_auth_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'arena-videos' AND auth.uid() IS NOT NULL);
CREATE POLICY "videos_auth_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'arena-videos' AND auth.uid() IS NOT NULL);
