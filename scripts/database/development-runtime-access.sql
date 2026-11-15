-- DEVELOPMENT ONLY: apply through the Supabase connection pinned to
-- dusqdnebwkoycdtjkhyy. Never add this file to prisma/migrations or apply
-- it to canonical production. Password provisioning is separate and private.
-- The server-only login is not an authenticator/anon/authenticated member.
-- Backend RLS bypass follows Supabase's Prisma pattern; frontend RLS stays on.
CREATE ROLE gem_dev_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION BYPASSRLS CONNECTION LIMIT 6;
-- Existing project administrator can inspect/test the narrower runtime role.
GRANT gem_dev_runtime TO postgres;
GRANT CONNECT ON DATABASE postgres TO gem_dev_runtime;
GRANT USAGE ON SCHEMA public TO gem_dev_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gem_dev_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gem_dev_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gem_dev_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO gem_dev_runtime;
ALTER ROLE gem_dev_runtime SET search_path = public, extensions;
ALTER ROLE gem_dev_runtime SET statement_timeout = '30s';
ALTER ROLE gem_dev_runtime SET idle_in_transaction_session_timeout = '30s';
COMMENT ON ROLE gem_dev_runtime IS 'Server-only GEM development runtime; dusqdnebwkoycdtjkhyy; no DDL or role administration';
-- To revoke future login, ALTER ROLE gem_dev_runtime NOLOGIN. For a hard
-- stop, terminate only this role's development sessions after pausing the app.
