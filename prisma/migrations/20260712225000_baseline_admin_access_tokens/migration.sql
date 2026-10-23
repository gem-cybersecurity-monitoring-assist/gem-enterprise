-- Baseline for public.admin_access_tokens.
-- The table was created by hand in the Supabase SQL editor and never captured in Git
-- (see docs/GEM_MIGRATION_INTEGRITY_20261017.md). This definition was taken from a
-- read-only catalog capture of production on 2026-10-23, not inferred from code usage.
-- Sorts before 20260712225500 so an empty database can replay the chain.
-- Idempotent: safe where the table already exists (production).

CREATE TABLE IF NOT EXISTS public.admin_access_tokens (
  id         text        NOT NULL DEFAULT (gen_random_uuid())::text,
  user_id    text        NOT NULL,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  run_secret text,
  request_id text,
  CONSTRAINT admin_access_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT admin_access_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT admin_access_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS admin_access_tokens_expires_at_idx ON public.admin_access_tokens (expires_at);
CREATE INDEX IF NOT EXISTS admin_access_tokens_user_id_idx    ON public.admin_access_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS admin_access_tokens_request_id_key
  ON public.admin_access_tokens (request_id) WHERE request_id IS NOT NULL;

-- Production: RLS enabled (not forced), no policies, no grants to anon/authenticated.
ALTER TABLE public.admin_access_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.admin_access_tokens FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.admin_access_tokens FROM authenticated';
  END IF;
END $$;
