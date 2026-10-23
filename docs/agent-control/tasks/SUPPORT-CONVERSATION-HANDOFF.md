# GEM Support — Intent-Aware Conversation And Human Handoff

## TASK ID
SUPPORT-CONVERSATION-HANDOFF

## OWNER
Codex / GEM support experience lane

## BASE SHA
`ec6ad016cef7599d06155187e666ce7af820e75e`

## WORKING BRANCH
`codex/support-conversation-handoff`

## OBJECTIVE
Make Platform Support understand common member requests, provide a concise
solution with a direct action, maintain useful follow-up choices, and transfer
unresolved work into the existing private human-support conversation without
pretending that a human is connected before an authorized operator joins.

## OWNED FILES

- `src/lib/ai/support-knowledge.ts`
- `src/lib/ai/gem-support-agent.ts`
- `src/lib/orchestration/orchestrate-support-reply.ts`
- `src/app/api/support/message/route.ts`
- `src/types/support.ts`
- `src/components/AIChatWidget.tsx`
- `src/components/support/SupportCaseConversation.tsx`
- `.vercelignore` (retain the existing News cadence migration required by preview verification)
- `src/components/auth/RoleLoginPortal.tsx` and `src/lib/supabase-gateway.ts` (normalize the hosted authentication error that blocked preview acceptance)
- focused support tests
- `design-qa.md` (support-flow section)
- this task record
- `docs/agent-control/ACTIVE-WORK.md` (this entry only)

## FORBIDDEN OVERLAP

- Authentication and portal-role policy
- Prisma schema and migrations
- Provider credentials or production configuration
- Integration catalogue, GEM News, and IWW files
- Active PR #291, #292, #252, #330, #331, and #334 file sets outside this task

## ACCEPTANCE CRITERIA

- Account-creation language routes to controlled Access Intake.
- GEM Assist capability questions receive a useful product explanation.
- Continuity mode remains useful when the model provider is unavailable.
- Responses expose direct verified routes and relevant follow-up choices.
- Explicit human requests create a durable tracked case with the transcript.
- The UI states that the case is waiting until a real operator claims it.
- Clients and staff can continue the private case thread with visible status.
- Focused tests, lint, typecheck, full tests, build, and design QA pass.

## ROLLBACK POINT
`ec6ad016cef7599d06155187e666ce7af820e75e`

## HUMAN GATES
No AI response may be presented as a human reply. External service-desk
activation and provider credentials remain separately authorized operations.

## LOCAL VERIFICATION

- Focused support tests: 3 files / 13 tests passed.
- ESLint: passed with zero warnings.
- TypeScript: passed.
- Full Vitest suite: 114 files / 682 tests passed.
- Prisma structural checks and schema validation: passed with non-secret local validation URLs.
- Public claims report: current.
- Next.js production build: passed; 358 pages generated.
- Cloud browser: server-rendered preview loaded, but client hydration of the temporary interaction harness did not execute; preview-only files were removed.
