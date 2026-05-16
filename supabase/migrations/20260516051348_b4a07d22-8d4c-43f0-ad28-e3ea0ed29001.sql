
CREATE TABLE public.arena_ingest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX idx_arena_ingest_tokens_arena ON public.arena_ingest_tokens(arena_id);
CREATE INDEX idx_arena_ingest_tokens_hash ON public.arena_ingest_tokens(token_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.arena_ingest_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingest_tokens_admin_all"
  ON public.arena_ingest_tokens
  FOR ALL
  USING (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.is_arena_admin(auth.uid(), arena_id) OR public.has_role(auth.uid(), 'superadmin'::app_role));
