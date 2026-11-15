-- DEVELOPMENT ONLY: dusqdnebwkoycdtjkhyy. Generated values never belong in
-- source, migration history, notices, errors, or screenshots. Remains NOLOGIN.
DO $provision$
DECLARE v_password text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gem_dev_runtime' AND NOT rolcanlogin) THEN
    RAISE EXCEPTION 'Expected development role is unavailable or already active';
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name='gem-development-runtime-dusqdnebwkoycdtjkhyy') THEN
    RAISE EXCEPTION 'Development credential already exists; do not rotate implicitly';
  END IF;
  v_password := encode(extensions.gen_random_bytes(32), 'hex');
  PERFORM vault.create_secret(v_password, 'gem-development-runtime-dusqdnebwkoycdtjkhyy', 'Isolated GEM development runtime; Vercel Preview only');
  EXECUTE format('ALTER ROLE %I PASSWORD %L', 'gem_dev_runtime', v_password);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Development password provisioning failed; transaction rolled back';
END;
$provision$;
