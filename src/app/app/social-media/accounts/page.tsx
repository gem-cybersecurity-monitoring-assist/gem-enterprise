import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { SocialConnectorPanel } from "@/components/social-media/SocialConnectorPanel";
import { db } from "@/lib/db";
import { isAdminRole, requireSession } from "@/lib/api/auth-helpers";
import { resolveWorkspaceAccess } from "@/lib/workspaceAccess";
import { getSafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";
import {
  getSocialMediaProviderReadiness,
  type SocialMediaReadinessState,
} from "@/lib/social-media/providers";

function StatusBadge({ state }: { state: SocialMediaReadinessState }) {
  const configured = state !== "CONFIGURATION_REQUIRED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
        configured
          ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
          : "border-rose-500/25 bg-rose-500/10 text-rose-300"
      }`}
    >
      {configured ? <LockKeyhole className="h-3.5 w-3.5" /> : <CircleOff className="h-3.5 w-3.5" />}
      {state.replaceAll("_", " ")}
    </span>
  );
}

export default async function SocialMediaAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string | string[] }>;
}) {
  const gate = await requireSession();
  if (!gate.ok || gate.accountStatus !== "active") {
    redirect("/admin-login?next=/app/social-media/accounts");
  }

  const params = await searchParams;
  const requestedWorkspaceId = Array.isArray(params.workspace)
    ? params.workspace[0]?.trim() || null
    : params.workspace?.trim() || null;
  const membershipResolution = await resolveWorkspaceAccess(
    gate.session.userId,
    requestedWorkspaceId,
  );
  let publishingWorkspace = membershipResolution.selected
    ? { id: membershipResolution.selected.id, name: membershipResolution.selected.name }
    : null;

  // Admin publishing is organization-scoped. Prefer the admin's organization,
  // then the canonical controlled-production workspace used by GEM/TokMetric.
  // This removes the dead-end manual workspace-ID requirement for GEM Admin.
  if (!publishingWorkspace && isAdminRole(gate.session.role) && gate.session.organizationId) {
    publishingWorkspace = await db.workspace.findFirst({
      where: {
        ...(requestedWorkspaceId ? { id: requestedWorkspaceId } : {}),
        organizationId: gate.session.organizationId,
        organization: { status: "active" },
      },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
  }

  if (!publishingWorkspace && isAdminRole(gate.session.role) && !requestedWorkspaceId) {
    const canonicalWorkspaceId =
      process.env.CONTENT_ORCHESTRATOR_WORKSPACE_ID?.trim();
    const serviceActorId =
      process.env.CONTENT_ORCHESTRATOR_ACTOR_ID?.trim();

    if (canonicalWorkspaceId && serviceActorId) {
      const serviceActor = await db.user.findFirst({
        where: {
          id: serviceActorId,
          status: "active",
          isActive: true,
          organizationId: { not: null },
        },
        select: { organizationId: true },
      });

      if (serviceActor?.organizationId) {
        publishingWorkspace = await db.workspace.findFirst({
          where: {
            id: canonicalWorkspaceId,
            organizationId: serviceActor.organizationId,
            organization: { status: "active" },
          },
          select: { id: true, name: true },
        });
      }
    }
  }

  const providers = getSocialMediaProviderReadiness();
  const oauthProviders = getSafeSocialOAuthReadiness();
  const configured = providers.filter((provider) => provider.configurationReady).length;
  const connectedForWrites = providers.filter((provider) => provider.externalWriteAllowed).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <article className="rounded-2xl border border-white/10 bg-card/75 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-bold text-white">Connect business destinations</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Authorize the exact Facebook Page, Instagram professional account, X account, LinkedIn organization,
            YouTube channel, Nextdoor destination, TikTok account, or approved Indeed employer feed your team is
            permitted to manage. GEM uses provider authorization flows; account passwords are never entered here.
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-semibold">Current readiness</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-black/10 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">Configured</p>
              <p className="mt-2 text-2xl font-bold text-white">{configured}/{providers.length}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/10 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">Live-ready</p>
              <p className="mt-2 text-2xl font-bold text-white">{connectedForWrites}</p>
            </div>
          </div>
        </article>
      </section>

      <SocialConnectorPanel
        providers={oauthProviders}
        workspaceId={publishingWorkspace?.id ?? null}
        workspaceLabel={publishingWorkspace?.name ?? null}
        allowManualWorkspaceInput={false}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {providers.map((provider) => (
          <article key={provider.id} className="rounded-2xl border border-white/10 bg-card/75 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  {provider.connectionMode === "EMPLOYER_FEED" ? (
                    <BriefcaseBusiness className="h-5 w-5 text-cyan-300" />
                  ) : (
                    <KeyRound className="h-5 w-5 text-cyan-300" />
                  )}
                  <h2 className="font-semibold text-white">{provider.label}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{provider.purpose}</p>
              </div>
              <StatusBadge state={provider.state} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {provider.supportedContent.map((contentType) => (
                <span
                  key={contentType}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300"
                >
                  {contentType.replaceAll("_", " ")}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-xs text-slate-400">
              {provider.restrictions.map((restriction) => (
                <div key={restriction} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span>{restriction}</span>
                </div>
              ))}
            </div>

            {provider.platformApprovalRequired ? (
              <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3 text-xs text-amber-100/80">
                Platform approval: {provider.platformApprovalGranted ? "recorded" : "required before live activation"}
              </div>
            ) : null}

            {provider.missingConfiguration.length > 0 ? (
              <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/[0.05] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-rose-300">
                  Owner configuration still required
                </p>
                <p className="mt-2 text-xs leading-5 text-rose-100/70">
                  Your administrator must complete the provider application configuration before an account can be authorized.
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
