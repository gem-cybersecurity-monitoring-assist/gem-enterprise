# Social workspace navigation

Owner: ChatGPT Work. Issue #498. Branch: fix/social-workspace-navigation.
Base: 7c6ef0e5defac773ca86e00d256ab62caada866b.

Production reproduction: shared suite/channel links drop the workspace query;
the unscoped accounts page selects another authorized workspace and hides the
existing GEM account inventory. Preserve explicit selection and expose only
existing accessible memberships as workspace choices. Do not hardcode a tenant
or change default workspace resolution.

Owned files: SocialMediaSuiteNav, its layout Suspense boundary, accounts page, in-page suite links,
new workspace chooser, channel route helper, regression tests and this record.
Prior overlapping shared-connection and destination-probe lanes are merged
(PR #492 and #494); development PR #497 owns separate deployment files.

Acceptance: selected workspace survives suite/channel navigation; chooser uses
only server-authorized membership data and preserves provider; callback state
is not carried between workspaces; existing server authorization remains in
force. Mobile controls have at least 44px targets. No credentials, database
schema, provider grants, publishing flags, deployment or paid services changed.

Verification: rendered navigation/chooser tests, existing authorization tests,
repository checks, independent review, exact-head hosted checks and preview.
Rollback: revert this focused change. Status: IMPLEMENTED; hosted verification pending.

Local validation: Node 24.22.1 / pnpm 10.28.0; 21 focused tests and all
1,484 tests across 221 files passed. Lint, typecheck, schema generation and
consistency, claims report and production build passed. Aggregate pnpm verify
stops at tsx IPC listen EPERM; identical claims script passed via node --import
tsx, then remaining checks passed individually. Independent review findings
were fixed and re-reviewed with no concrete blockers. No production release
or owner-authenticated preview acceptance is claimed.
