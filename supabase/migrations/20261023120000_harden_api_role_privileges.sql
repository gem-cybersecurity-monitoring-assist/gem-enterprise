-- Defence in depth: the browser-facing API roles (anon, authenticated) get no implicit
-- access to application objects in schema public.
--
-- Why this is safe for this codebase:
--   * Every Supabase edge function in supabase/functions connects with the service role.
--   * The Next.js server uses Prisma (table owner) and, for the legacy Facebook routes,
--     the service-role key.
--   * src/integrations/supabase/client.ts (publishable key) is not imported by any route.
--   * Row Level Security is enabled on every public table; this removes the grants that
--     the Supabase platform default would otherwise add to every future table.
--
-- Scope: tables and sequences that exist today, and default privileges for objects that
-- role `postgres` creates later in schema public (migrations and SQL editor). Existing
-- function grants are not touched. Default privileges owned by supabase_admin cannot be
-- altered by this role and are not covered.
--
-- Rollback (scripted re-grant, run only if an API-role dependency is found):
--   GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
