import Link from "next/link";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { getGatewaySessionToken } from "@/lib/auth";
import { workspaceGateway } from "@/lib/supabase-gateway";
import { listAccessibleWorkspaces, type AccessibleWorkspace } from "@/lib/workspaceAccess";
import { hasScopedSocialTransactionalAuthority } from "@/lib/social-media/transactional-authority";
import { getSafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";
import { socialAccountsHref, socialSuiteHref } from "@/lib/social-media/channel-routes";
import { SocialConnectorPanel } from "./SocialConnectorPanel";

const commandCenter = "/app/command-center/social-media";

export async function CommandCenterSocialAccounts({ workspaceId }: { workspaceId: string | null }) {
  const gate = await requireAdmin();
  if (!gate.ok) return null;

  const gateway = gate.session.authSource === "supabase_gateway";
  const token = gateway ? await getGatewaySessionToken().catch(() => null) : null;
  if (gateway && !token) return <p role="status">Account verification requires an active gateway session.</p>;
  let workspaces: AccessibleWorkspace[];
  try {
    if (token) {
      ({ workspaces } = await workspaceGateway<{ workspaces: AccessibleWorkspace[] }>("access", token));
    } else {
      workspaces = await listAccessibleWorkspaces(gate.session.userId);
    }
  } catch {
    return <p role="status">Authorized workspaces could not be verified. Account controls are unavailable; retry this page.</p>;
  }
  const selected = workspaceId
    ? workspaces.find((workspace) => workspace.id === workspaceId)
    : workspaces[0];
  const backendAvailable = !gateway || hasScopedSocialTransactionalAuthority();
  // YouTube remains paused. Non-OAuth destinations retain their existing setup requirements.
  const providers = getSafeSocialOAuthReadiness().filter((provider) => provider.provider !== "YOUTUBE");

  return (
    <section aria-label="Actual workspace accounts" className="space-y-4 rounded-2xl border border-cyan-300/20 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-white">Manage actual social accounts</h2>
      <p className="text-sm text-slate-400">
        Select an authorized workspace, inspect saved account identities and run credential health checks.
        A saved account or successful identity check does not authorize publishing.
      </p>
      {workspaces.length > 0 && (
        <nav aria-label="Command Center social workspaces" className="flex flex-wrap gap-2">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={socialSuiteHref(commandCenter, workspace.id)}
              aria-current={selected?.id === workspace.id ? "page" : undefined}
              className="rounded-lg border border-white/15 px-4 py-3 text-sm text-cyan-200 aria-[current=page]:bg-cyan-400/15">
              {workspace.name}
            </Link>
          ))}
        </nav>
      )}
      {!selected ? (
        <p role="status" className="text-sm text-amber-100">No authorized workspace is selected. Choose an available workspace to inspect accounts.</p>
      ) : !backendAvailable ? (
        <p role="status" className="text-sm text-amber-100">The verified social credential backend is unavailable. No account status is inferred.</p>
      ) : (
        <SocialConnectorPanel key={selected.id} providers={providers} workspaceId={selected.id}
          workspaceLabel={selected.name} allowManualWorkspaceInput={false} />
      )}
      {selected && (
        <Link href={socialAccountsHref(undefined, selected.id)} className="inline-flex rounded-lg border border-cyan-400/25 px-4 py-3 text-sm text-cyan-200">
          Open full account workspace
        </Link>
      )}
    </section>
  );
}
