#!/usr/bin/env bash
# Replays prisma/migrations, in Prisma's order, into a DISPOSABLE PostgreSQL database and
# reports the first failure. Each migration runs in its own transaction with ON_ERROR_STOP.
# The database is dropped and recreated, so its name must end with "_test".
#
#   PGHOST=/path/to/socket PGUSER=... PGPASSWORD=... \
#   scripts/verify-migration-chain.sh <db_name_test> [--stub <supabase-stub.sql>] [--skip <file>] [--migrations <dir>]
#
# --stub  loads MOCK stand-ins for Supabase-managed objects (storage.buckets, cron, net, roles)
#         and strips "CREATE EXTENSION IF NOT EXISTS pg_cron" from the migration that needs it.
#         Without --stub the run is plain PostgreSQL.
# --skip  file of migration names to skip (one per line); every skip is printed.
set -u
DB=${1:-}
shift || true
STUB="" SKIP="" MIG="prisma/migrations"
while [ $# -gt 0 ]; do
  case "$1" in
    --stub) STUB=$2; shift 2 ;;
    --skip) SKIP=$2; shift 2 ;;
    --migrations) MIG=$2; shift 2 ;;
    *) echo "unknown argument: $1"; exit 2 ;;
  esac
done
case "$DB" in *_test) ;; *) echo "Refusing: database name must end with _test (it is dropped and recreated)."; exit 2 ;; esac

psql -d postgres -qc "DROP DATABASE IF EXISTS \"$DB\"" -c "CREATE DATABASE \"$DB\"" >/dev/null || exit 2
if [ -n "$STUB" ]; then
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$STUB" >/dev/null || exit 2
  echo "  MOCK     Supabase compatibility objects loaded from $STUB"
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
ok=0 skipped=0
for dir in $(ls -d "$MIG"/*/ | sort); do
  name=$(basename "$dir")
  if [ -n "$SKIP" ] && grep -qx "$name" "$SKIP"; then
    echo "  SKIPPED  $name"; skipped=$((skipped + 1)); continue
  fi
  sql="$dir/migration.sql"
  if [ -n "$STUB" ] && grep -q "CREATE EXTENSION IF NOT EXISTS pg_cron" "$sql"; then
    grep -v "CREATE EXTENSION IF NOT EXISTS pg_cron" "$sql" > "$tmp"; sql=$tmp
    echo "  MOCK     $name (CREATE EXTENSION pg_cron removed; stub cron schema used)"
  fi
  if ! out=$(psql -d "$DB" -q -v ON_ERROR_STOP=1 -1 -f "$sql" 2>&1); then
    echo "  FAILED   $name"
    echo "$out" | grep -m1 "ERROR" | sed 's/^/           /'
    echo "  RESULT   applied=$ok skipped=$skipped stopped_at=$name"
    exit 1
  fi
  ok=$((ok + 1))
done
echo "  RESULT   applied=$ok skipped=$skipped complete"
