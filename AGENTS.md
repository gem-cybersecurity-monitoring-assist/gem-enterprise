# GEM Enterprise Agent Map

- Repository: `support371/gem-enterprise`
- Default branch: `main`
- Runtime: Node.js 24.x
- Package manager: `pnpm@10.28.0` only
- Operating mode: controlled production launch; sensitive and provider-dependent features fail closed.

## Repository map

- `src/app/`: pages and API routes
- `src/components/`: reusable UI
- `src/lib/`: shared server and domain logic
- `prisma/`: schema and migrations
- `scripts/`: build and operational tooling
- `docs/`: architecture, operations, and governance
- `docs/agent-control/`: persistent multi-agent control plane

## Canonical commands

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run verify
```

Use focused checks when the task contract separates configuration-independent
tests from configuration-dependent tests. Never claim a skipped or unstarted
check passed.

## Mutation rules

1. Read [ACTIVE-WORK](docs/agent-control/ACTIVE-WORK.md) and the linked task
   contract before mutation.
2. Only one mutation owner may control an overlapping file set. Do not silently
   take another lane or mutate forbidden files.
3. Inspect current `main`, the source head, drift, changed files, reviews, and
   exact-head checks. Do not blindly rebase a stale PR.
4. Stop when repository, branch, source, or environment identity is `UNKNOWN`.
5. Never place secret values in prompts, code, commits, logs, tests, issues,
   screenshots, or artifacts. Use variable names and approved secret stores.
6. Do not mutate Prisma to bypass missing configuration. Database changes
   require compatibility, migration, rollback, and owner-approved execution.
7. Configuration-independent work may continue when database configuration is
   blocked, provided its task contract and file ownership permit it.
8. Do not merge merely to reduce PR count. Supersession and merge readiness must
   be proven under [MERGE-GATES](docs/agent-control/MERGE-GATES.md).
9. Exact-head evidence is required before claiming `PASS`.
   `BLOCKED` or `HUMAN_REQUIRED` cannot become `PASS` without new evidence.
10. Vercel Git integration owns production deployment. Agents must not activate
    paid services, make production/provider changes, or run an independent
    production deployment without explicit approval.

Preserve existing authentication, audit, validation, design-system, and
fail-closed boundaries. See [CLAUDE.md](CLAUDE.md) for the application map and
[AGENT_BUILD_FLOW](docs/AGENT_BUILD_FLOW.md) for the delivery procedure.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
