-- GEM Supabase READ-ONLY security audit pack
-- Guide: docs/security/GEM_SUPABASE_READONLY_AUDIT.md
--
-- Every statement below reads PostgreSQL catalog metadata or evaluates privilege functions
-- (has_table_privilege, has_column_privilege, ...). Nothing reads business rows, password
-- hashes, tokens, customer records, secrets or environment variables, and nothing writes.
-- The first statement puts the transaction in read-only mode as an extra guard.
--
-- Supabase SQL Editor shows only the LAST statement's result:
--   * Run the whole file to get section 10, the consolidated findings.
--   * To see one section, highlight "SET LOCAL ..." plus that section's SELECT and run the selection.
-- psql shows every section, in ONE read-only transaction (-1 is required for SET LOCAL):
--   psql "<connection string>" -X -1 -v ON_ERROR_STOP=1 -f gem-supabase-readonly-audit.sql

SET LOCAL transaction_read_only = on;

-- =============================================================================================
-- 1. API roles: attributes and memberships
--    rolbypassrls = true on anon/authenticated would bypass every RLS policy.
--    service_role normally has BYPASSRLS (server-side key; expected).
-- =============================================================================================
SELECT r.rolname,
       r.rolsuper,
       r.rolbypassrls,
       r.rolinherit,
       r.rolcanlogin,
       coalesce((SELECT string_agg(g.rolname, ', ' ORDER BY g.rolname)
                 FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                 WHERE m.member = r.oid), '') AS member_of
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres')
ORDER BY r.rolname;

-- =============================================================================================
-- 2. Every relation in schema public: RLS state and EFFECTIVE privileges per API role.
--    has_table_privilege/has_any_column_privilege include grants via PUBLIC and inherited roles.
--    Classification (per role) is explained in the guide, section 4.
-- =============================================================================================
WITH api_roles AS (
  SELECT oid, rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
), rels AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         coalesce((SELECT bool_or(o = 'security_invoker=true' OR o = 'security_invoker=on')
                   FROM unnest(c.reloptions) o), false) AS security_invoker,
         c.relname ~ '(user|session|kyc|audit|ticket|token|credential|secret|password|invitation|evidence|consent|contact|subscriber|decision|notification|api_key|message|payment|billing)' AS sensitive
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
), grid AS (
  SELECT rl.*, ar.rolname, ar.rolbypassrls,
         has_schema_privilege(ar.oid, 'public', 'USAGE') AS schema_usage,
         has_table_privilege(ar.oid, rl.oid, 'SELECT') AS can_select,
         has_table_privilege(ar.oid, rl.oid, 'INSERT') AS can_insert,
         has_table_privilege(ar.oid, rl.oid, 'UPDATE') AS can_update,
         has_table_privilege(ar.oid, rl.oid, 'DELETE') AS can_delete,
         has_any_column_privilege(ar.oid, rl.oid, 'SELECT') AS can_select_some_column,
         (SELECT count(*) FROM pg_policy p
          WHERE p.polrelid = rl.oid
            AND (0::oid = ANY (p.polroles) OR ar.oid = ANY (p.polroles)
                 OR EXISTS (SELECT 1 FROM unnest(p.polroles) pr
                            WHERE pr <> 0 AND pg_has_role(ar.oid, pr, 'MEMBER')))) AS applicable_policies
  FROM rels rl CROSS JOIN api_roles ar
)
SELECT relname,
       CASE relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned' WHEN 'v' THEN 'view'
                    WHEN 'm' THEN 'matview' WHEN 'f' THEN 'foreign' END AS kind,
       sensitive, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced,
       rolname AS api_role, schema_usage,
       can_select, can_insert, can_update, can_delete, can_select_some_column,
       applicable_policies,
       CASE
         WHEN NOT schema_usage OR NOT (can_select OR can_insert OR can_update OR can_delete OR can_select_some_column)
           THEN 'NO_PRIVILEGE'
         WHEN rolbypassrls THEN 'DB_ACCESS_BYPASSRLS'
         WHEN relkind = 'm' THEN 'DB_ACCESS_MATVIEW_NO_RLS'
         WHEN relkind = 'v' AND NOT security_invoker THEN 'DB_ACCESS_VIEW_OWNER_RIGHTS'
         WHEN relkind = 'v' THEN 'VIEW_INVOKER_CHECK_BASE_TABLES'
         WHEN relkind = 'f' THEN 'DB_ACCESS_FOREIGN_TABLE'
         WHEN NOT relrowsecurity THEN 'DB_ACCESS_NO_RLS'
         WHEN applicable_policies > 0 THEN 'POLICY_DEPENDENT'
         ELSE 'GRANTED_BUT_RLS_DENIES'
       END AS classification
FROM grid
ORDER BY sensitive DESC, relname, rolname;

-- =============================================================================================
-- 3. RLS policies in public: target roles, command, permissive/restrictive and expressions.
--    Expressions are policy definitions (schema metadata), truncated to 300 characters.
-- =============================================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       left(coalesce(qual, ''), 300) AS using_expression,
       left(coalesce(with_check, ''), 300) AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================================
-- 4. Explicit ACL entries on public relations granted to API roles or PUBLIC (grant source).
-- =============================================================================================
SELECT c.relname,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       a.grantor::regrole::text AS grantor,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privileges
FROM pg_class c
CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND (a.grantee = 0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')))
GROUP BY 1, 2, 3
ORDER BY 1, 2;

-- =============================================================================================
-- 5. Column-level grants to API roles or PUBLIC (can expose a column without a table grant).
-- =============================================================================================
SELECT c.relname, att.attname AS column_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privileges
FROM pg_attribute att
JOIN pg_class c ON c.oid = att.attrelid
CROSS JOIN LATERAL aclexplode(att.attacl) a
WHERE c.relnamespace = 'public'::regnamespace AND att.attnum > 0 AND NOT att.attisdropped
  AND (a.grantee = 0 OR a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')))
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- =============================================================================================
-- 6. Functions in public callable by anon/authenticated (Data API RPC surface).
--    SECURITY DEFINER functions run with the owner's rights and bypass RLS.
-- =============================================================================================
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       coalesce(array_to_string(p.proconfig, ' '), '') AS settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY p.prosecdef DESC, p.proname;

-- =============================================================================================
-- 7. Default privileges in schema public (what FUTURE tables/functions will grant).
-- =============================================================================================
SELECT d.defaclrole::regrole::text AS owner_role,
       CASE d.defaclobjtype WHEN 'r' THEN 'tables' WHEN 'S' THEN 'sequences' WHEN 'f' THEN 'functions'
                            WHEN 'T' THEN 'types' WHEN 'n' THEN 'schemas' END AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privileges
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclnamespace IN (0, 'public'::regnamespace)
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- =============================================================================================
-- 8. admin_access_tokens: existence, structure and access rules. NO row data is read.
--    Returns a single "absent" row if the table does not exist.
-- =============================================================================================
WITH t AS (SELECT to_regclass('public.admin_access_tokens') AS oid)
SELECT 'existence' AS aspect, CASE WHEN t.oid IS NULL THEN 'absent' ELSE 'present' END AS item, '' AS detail FROM t
UNION ALL
SELECT 'rls', 'enabled=' || c.relrowsecurity || ' forced=' || c.relforcerowsecurity, 'owner=' || c.relowner::regrole::text
FROM t JOIN pg_class c ON c.oid = t.oid
UNION ALL
SELECT 'column', att.attname,
       format_type(att.atttypid, att.atttypmod) || CASE WHEN att.attnotnull THEN ' NOT NULL' ELSE '' END
       || coalesce(' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid), '')
FROM t JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum > 0 AND NOT att.attisdropped
LEFT JOIN pg_attrdef ad ON ad.adrelid = att.attrelid AND ad.adnum = att.attnum
UNION ALL
SELECT 'constraint', con.conname, pg_get_constraintdef(con.oid) FROM t JOIN pg_constraint con ON con.conrelid = t.oid
UNION ALL
SELECT 'index', ic.relname, pg_get_indexdef(i.indexrelid)
FROM t JOIN pg_index i ON i.indrelid = t.oid JOIN pg_class ic ON ic.oid = i.indexrelid
UNION ALL
SELECT 'trigger', tg.tgname, pg_get_triggerdef(tg.oid) FROM t JOIN pg_trigger tg ON tg.tgrelid = t.oid AND NOT tg.tgisinternal
UNION ALL
SELECT 'policy', p.policyname, p.cmd || ' to ' || array_to_string(p.roles, ',')
FROM t JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = 'admin_access_tokens'
UNION ALL
SELECT 'effective_privilege', r.rolname,
       'select=' || has_table_privilege(r.oid, t.oid, 'SELECT') || ' insert=' || has_table_privilege(r.oid, t.oid, 'INSERT')
       || ' update=' || has_table_privilege(r.oid, t.oid, 'UPDATE') || ' delete=' || has_table_privilege(r.oid, t.oid, 'DELETE')
       || ' bypassrls=' || r.rolbypassrls
FROM t JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated', 'service_role') WHERE t.oid IS NOT NULL
UNION ALL
SELECT 'function_using_table', p.proname,
       'security_definer=' || p.prosecdef || ' anon_execute=' || has_function_privilege('anon', p.oid, 'EXECUTE')
       || ' authenticated_execute=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc LIKE '%admin_access_tokens%';

-- =============================================================================================
-- 9. Supabase platform objects the migrations depend on (metadata only).
-- =============================================================================================
SELECT 'extension' AS kind, e.extname AS name, e.extversion AS detail
FROM pg_extension e WHERE e.extname IN ('pg_cron', 'pg_net', 'pgcrypto', 'pg_graphql')
UNION ALL
SELECT 'schema', n.nspname, 'present' FROM pg_namespace n WHERE n.nspname IN ('storage', 'cron', 'net', 'extensions', 'graphql_public')
UNION ALL
SELECT 'storage_buckets_table', 'storage.buckets', CASE WHEN to_regclass('storage.buckets') IS NULL THEN 'absent' ELSE 'present' END
ORDER BY 1, 2;

-- =============================================================================================
-- 10. CONSOLIDATED FINDINGS (last statement: this is what the SQL Editor shows for "Run").
--     One row per finding; severity and wording are explained in the guide, section 4.
-- =============================================================================================
WITH api_roles AS (
  SELECT oid, rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
), rels AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity,
         coalesce((SELECT bool_or(o = 'security_invoker=true' OR o = 'security_invoker=on')
                   FROM unnest(c.reloptions) o), false) AS security_invoker,
         c.relname ~ '(user|session|kyc|audit|ticket|token|credential|secret|password|invitation|evidence|consent|contact|subscriber|decision|notification|api_key|message|payment|billing)' AS sensitive
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
), grid AS (
  SELECT rl.*, ar.rolname, ar.rolbypassrls,
         has_schema_privilege(ar.oid, 'public', 'USAGE') AS schema_usage,
         array_remove(ARRAY[
           CASE WHEN has_table_privilege(ar.oid, rl.oid, 'SELECT') THEN 'SELECT' END,
           CASE WHEN has_table_privilege(ar.oid, rl.oid, 'INSERT') THEN 'INSERT' END,
           CASE WHEN has_table_privilege(ar.oid, rl.oid, 'UPDATE') THEN 'UPDATE' END,
           CASE WHEN has_table_privilege(ar.oid, rl.oid, 'DELETE') THEN 'DELETE' END,
           CASE WHEN NOT has_table_privilege(ar.oid, rl.oid, 'SELECT') AND has_any_column_privilege(ar.oid, rl.oid, 'SELECT')
                THEN 'SELECT(columns)' END], NULL) AS privs,
         (SELECT count(*) FROM pg_policy p
          WHERE p.polrelid = rl.oid
            AND (0::oid = ANY (p.polroles) OR ar.oid = ANY (p.polroles)
                 OR EXISTS (SELECT 1 FROM unnest(p.polroles) pr
                            WHERE pr <> 0 AND pg_has_role(ar.oid, pr, 'MEMBER')))) AS applicable_policies
  FROM rels rl CROSS JOIN api_roles ar
), findings AS (
  SELECT CASE
           WHEN rolbypassrls OR relkind IN ('m', 'f') OR (relkind = 'v' AND NOT security_invoker)
                OR (relkind IN ('r', 'p') AND NOT relrowsecurity)
             THEN CASE WHEN sensitive THEN 'CRITICAL' ELSE 'HIGH' END
           WHEN applicable_policies > 0 OR relkind = 'v' THEN 'REVIEW'
           ELSE 'LOW'
         END AS severity,
         CASE
           WHEN rolbypassrls THEN 'DB_ACCESS_BYPASSRLS'
           WHEN relkind = 'm' THEN 'DB_ACCESS_MATVIEW_NO_RLS'
           WHEN relkind = 'v' AND NOT security_invoker THEN 'DB_ACCESS_VIEW_OWNER_RIGHTS'
           WHEN relkind = 'v' THEN 'VIEW_INVOKER_CHECK_BASE_TABLES'
           WHEN relkind = 'f' THEN 'DB_ACCESS_FOREIGN_TABLE'
           WHEN NOT relrowsecurity THEN 'DB_ACCESS_NO_RLS'
           WHEN applicable_policies > 0 THEN 'POLICY_DEPENDENT'
           ELSE 'GRANTED_BUT_RLS_DENIES'
         END AS finding,
         relname AS object, rolname AS api_role, array_to_string(privs, ',') AS privileges,
         sensitive, applicable_policies
  FROM grid
  WHERE schema_usage AND cardinality(privs) > 0
)
SELECT * FROM (
SELECT severity, finding, object, api_role, privileges, sensitive, applicable_policies
FROM findings
UNION ALL
SELECT 'CRITICAL', 'API_ROLE_HAS_BYPASSRLS', rolname, rolname, 'role attribute', true, 0
FROM pg_roles WHERE rolname IN ('anon', 'authenticated') AND rolbypassrls
UNION ALL
SELECT 'HIGH', 'SECURITY_DEFINER_CALLABLE_BY_API_ROLE', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anon' ELSE 'authenticated' END,
       'EXECUTE' || CASE WHEN p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ' ') LIKE '%search_path%'
                        THEN ' (no pinned search_path)' ELSE '' END,
       p.prosrc ~* '(admin_access_tokens|password|token|session)', 0
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
UNION ALL
SELECT 'INFO', 'ADMIN_ACCESS_TOKENS_' || CASE WHEN to_regclass('public.admin_access_tokens') IS NULL THEN 'ABSENT' ELSE 'PRESENT' END,
       'public.admin_access_tokens', '-', '-', true, 0
UNION ALL
SELECT 'INFO', 'AUDIT_COMPLETE_NO_API_ROLE_TABLE_ACCESS', 'schema public', '-', '-', false, 0
WHERE NOT EXISTS (SELECT 1 FROM findings)
) consolidated
ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'REVIEW' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END,
         finding, object, api_role;
