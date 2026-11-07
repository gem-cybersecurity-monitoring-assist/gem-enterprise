#!/usr/bin/env bash
# Prepares a cloud agent session (Claude Code on the web, Codex): installs
# dependencies and generates the Prisma client with CI placeholder values.
# Local machines are left alone.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${GEM_AGENT_SETUP:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

# Non-secret placeholders, identical to .github/workflows/ci.yml.
export JWT_SECRET="${JWT_SECRET:-ci-test-secret-min-32-characters-long-placeholder}"
export POSTGRES_PRISMA_URL="${POSTGRES_PRISMA_URL:-postgresql://ci:ci@localhost:5432/gem_ci}"
export POSTGRES_URL_NON_POOLING="${POSTGRES_URL_NON_POOLING:-postgresql://ci:ci@localhost:5432/gem_ci}"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm run db:generate

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export JWT_SECRET=\"$JWT_SECRET\""
    echo "export POSTGRES_PRISMA_URL=\"$POSTGRES_PRISMA_URL\""
    echo "export POSTGRES_URL_NON_POOLING=\"$POSTGRES_URL_NON_POOLING\""
  } >> "$CLAUDE_ENV_FILE"
fi
