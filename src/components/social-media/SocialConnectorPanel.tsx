"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  ExternalLink,
  KeyRound,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { matchesSocialDestination, socialAccountsHref } from "@/lib/social-media/channel-routes";
import type { SocialMediaProviderId } from "@/lib/social-media/providers";
import type { SafeSocialOAuthReadiness } from "@/lib/social-media/oauth/readiness";

type Connector = {
  id: string;
  workspaceId: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  safeMetadata: Record<string, unknown>;
  lastHealthAt: string | null;
  disabledAt: string | null;
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function metadataText(connector: Connector, key: string) {
  const value = connector.safeMetadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataBoolean(connector: Connector, key: string) {
  const value = connector.safeMetadata?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function lifecycleTone(lifecycle?: string) {
  if (lifecycle === "HEALTHY") return "text-emerald-200";
  if (lifecycle === "EXPIRING" || lifecycle === "EXPIRY_UNKNOWN") return "text-amber-100";
  if (lifecycle === "EXPIRED_REFRESHABLE") return "text-orange-200";
  if (lifecycle === "REAUTHORIZATION_REQUIRED") return "text-rose-200";
  return "text-white/55";
}

export function SocialConnectorPanel({
  providers,
  destination,
  workspaceId,
  workspaceLabel,
  allowManualWorkspaceInput = true,
}: {
  providers: SafeSocialOAuthReadiness[];
  destination?: SocialMediaProviderId;
  workspaceId?: string | null;
  workspaceLabel?: string | null;
  allowManualWorkspaceInput?: boolean;
}) {
  const [manualWorkspaceId, setManualWorkspaceId] = useState("");
  const resolvedWorkspaceId = workspaceId?.trim() || "";
  const effectiveWorkspaceId = resolvedWorkspaceId || manualWorkspaceId.trim();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [observedAt, setObservedAt] = useState(0);
  const [identityCheck, setIdentityCheck] = useState<{ workspaceId: string; connectorId: string; healthy: boolean; checkedAt: string }>();
  const [checkingIdentity, setCheckingIdentity] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [disconnecting, setDisconnecting] = useState<string>();
  const [checkingHealth, setCheckingHealth] = useState<string>();
  const canLoad = effectiveWorkspaceId.length > 0;
  const busy = Boolean(checkingHealth || checkingIdentity || disconnecting);

  async function loadConnectors(signal?: AbortSignal) {
    if (!canLoad) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/social-media/connectors?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}`,
        { signal, cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to load social connectors.");
      if (signal?.aborted) return;
      setObservedAt(Date.now());
      setConnectors(payload.connectors || []);
    } catch (caught) {
      if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setConnectors([]);
      setError(caught instanceof Error ? caught.message : "Unable to load social connectors.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!canLoad) {
      setConnectors([]);
      setError(undefined);
      return;
    }
    const controller = new AbortController();
    void loadConnectors(controller.signal);
    return () => controller.abort();
    // loadConnectors is intentionally driven only by the selected workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, effectiveWorkspaceId]);

  useEffect(() => {
    const now = Date.now();
    const nextExpiry = connectors
      .filter((connector) => connector.workspaceId === effectiveWorkspaceId)
      .map((connector) => Date.parse(metadataText(connector, "expiresAt") ?? ""))
      .filter((expiry) => Number.isFinite(expiry) && expiry > observedAt)
      .reduce((earliest, expiry) => Math.min(earliest, expiry), Infinity);
    const updateClock = () => setObservedAt(Date.now());
    const timer = Number.isFinite(nextExpiry)
      ? window.setTimeout(updateClock, Math.min(2_147_483_647, Math.max(0, nextExpiry - now)))
      : undefined;
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [connectors, effectiveWorkspaceId, observedAt]);

  function connect(provider: SafeSocialOAuthReadiness) {
    if (!canLoad || !provider.readyToAuthorize) return;
    const url = new URL(`/api/social-media/oauth/${provider.provider.toLowerCase()}/start`, window.location.origin);
    url.searchParams.set("workspaceId", effectiveWorkspaceId);
    url.searchParams.set("redirectAfter", socialAccountsHref(destination, effectiveWorkspaceId));
    window.location.assign(url.toString());
  }

  async function disconnect(connector: Connector) {
    const confirmed = window.confirm(
      `Disconnect ${connector.displayName}? The stored access and refresh credentials will be deleted.`,
    );
    if (!confirmed) return;
    setIdentityCheck(undefined);
    setDisconnecting(connector.id);
    setError(undefined);
    try {
      const response = await fetch("/api/social-media/connectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspaceId, connectorId: connector.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to disconnect connector.");
      await loadConnectors();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to disconnect connector.");
    } finally {
      setDisconnecting(undefined);
    }
  }

  async function verifyIdentity(connector: Connector) {
    setCheckingIdentity(connector.id);
    setIdentityCheck(undefined);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/social-media/connectors/${encodeURIComponent(connector.id)}/test?workspaceId=${encodeURIComponent(effectiveWorkspaceId)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to verify account identity.");
      if (payload.readOnlyProbe !== true || payload.connectorId !== connector.id ||
          typeof payload.healthy !== "boolean" || typeof payload.checkedAt !== "string" ||
          !Number.isFinite(Date.parse(payload.checkedAt))) {
        throw new Error("The account identity check returned an invalid result.");
      }
      setIdentityCheck({ workspaceId: effectiveWorkspaceId, connectorId: connector.id,
        healthy: payload.healthy, checkedAt: payload.checkedAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify account identity.");
    } finally {
      setCheckingIdentity(undefined);
    }
  }

  async function checkCredentialHealth(connector: Connector) {
    if (!window.confirm("Check credential health? This may refresh and rotate the stored access credential. It does not publish content.")) return;
    setIdentityCheck(undefined);
    setCheckingHealth(connector.id);
    setError(undefined);
    try {
      const response = await fetch("/api/social-media/connectors/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: effectiveWorkspaceId, connectorId: connector.id, liveProbe: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Unable to evaluate connector credential health.");
      }
      await loadConnectors();
    } catch (caught) {
      await loadConnectors().catch(() => undefined);
      setError(
        caught instanceof Error ? caught.message : "Unable to evaluate connector credential health.",
      );
    } finally {
      setCheckingHealth(undefined);
    }
  }

  const connectorsByProvider = useMemo(() => {
    const grouped = new Map<string, Connector[]>();
    for (const connector of connectors) {
      if (connector.workspaceId !== effectiveWorkspaceId) continue;
      if (!matchesSocialDestination(connector.provider, connector.safeMetadata, destination)) continue;
      if (connector.disabledAt || connector.state === "DISCONNECTED") continue;
      const existing = grouped.get(connector.provider) || [];
      existing.push(connector);
      grouped.set(connector.provider, existing);
    }
    return grouped;
  }, [connectors, destination, effectiveWorkspaceId]);

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Authorized account connectors
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">Workspace social accounts</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            GEM resolves the authorized publishing workspace from your authenticated account. Provider
            account discovery runs server-side after consent. Client secrets, access tokens, refresh tokens,
            and encrypted credential references are never returned to the browser.
          </p>
        </div>
        {resolvedWorkspaceId ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Publishing workspace
            </p>
            <p className="mt-1 font-semibold text-white">
              {workspaceLabel || "Authorized GEM workspace"}
            </p>
            <p className="mt-1 text-xs text-white/40">
              Resolved automatically from your authenticated GEM account.
            </p>
          </div>
        ) : allowManualWorkspaceInput ? (
          <input
            value={manualWorkspaceId}
            disabled={busy}
            onChange={(event) => setManualWorkspaceId(event.target.value)}
            placeholder="workspace ID"
            autoComplete="off"
            className="min-w-64 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
        ) : (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
            GEM publishing workspace is not available. No manual workspace ID is required.
          </div>
        )}
      </div>

      {!canLoad ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          {allowManualWorkspaceInput
            ? "No workspace selected. Enter an authorized workspace ID for this legacy management surface."
            : "GEM could not resolve the controlled publishing workspace. This is a server-side configuration issue, not a workspace ID you need to supply."}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connector state…
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {providers.map((provider) => {
          const providerConnectors = connectorsByProvider.get(provider.provider) || [];
          return (
            <article key={provider.provider} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-cyan-300" />
                    <h3 className="font-semibold text-white">{provider.displayName}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    Requested scopes: {provider.requestedScopes.length > 0 ? provider.requestedScopes.join(", ") : "not configured"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/40">
                    Account discovery: verified during authorization · Token recovery: {label(provider.refreshMode)}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
                  {providerConnectors.length > 0
                    ? `${providerConnectors.length} saved`
                    : provider.readyToAuthorize
                      ? "Authorization required"
                      : "Blocked"}
                </span>
              </div>

              {provider.platformApproval === "NEEDS_REVIEW" ? (
                <p className="mt-3 text-xs leading-5 text-amber-100">
                  Platform review is pending. The provider may limit authorization to app-role accounts and eligible assets. Publishing remains disabled.
                </p>
              ) : null}

              {provider.missing.length > 0 ? (
                <p className="mt-3 text-xs leading-5 text-amber-100">
                  Missing or blocked: {provider.missing.join(", ")}
                </p>
              ) : null}

              {providerConnectors.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {providerConnectors.map((connector) => {
                    const lifecycle = metadataText(connector, "tokenLifecycle");
                    const username = metadataText(connector, "username");
                    const expiresAt = metadataText(connector, "expiresAt");
                    const refreshTokenPresent = metadataBoolean(connector, "refreshTokenPresent");
                    const expiryTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
                    const expired = Number.isFinite(expiryTime) && expiryTime <= observedAt;
                    const currentIdentity = identityCheck?.workspaceId === effectiveWorkspaceId &&
                      identityCheck.connectorId === connector.id ? identityCheck : undefined;

                    const liveProbeAt = metadataText(connector, "liveProbeAt");
                    const liveProbeOk = metadataBoolean(connector, "liveProbeOk");
                    return (
                      <div
                        key={connector.id}
                        className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.04] p-3 text-sm text-white/60"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-white/80">
                              {connector.state === "CONNECTED" && !expired ? (
                                <CircleCheck className="h-4 w-4 text-emerald-300" />
                              ) : (
                                <TriangleAlert className="h-4 w-4 text-amber-200" />
                              )}
                              <p className="truncate font-semibold">{connector.displayName}</p>
                            </div>
                            <p className="mt-2">Account ID: {connector.externalAccountId || "discovery incomplete"}</p>
                            {username ? <p className="mt-1">Username: {username}</p> : null}
                            <p className="mt-1">Saved state: {label(connector.state)}</p>
                            <p className="mt-1">
                              Last live account check: {liveProbeAt && liveProbeOk !== undefined
                                ? `${liveProbeOk ? "Passed" : "Failed"} · ${new Date(liveProbeAt).toLocaleString()}`
                                : "Not recorded"}
                            </p>
                            <p className={`mt-1 ${expired ? "text-rose-200" : lifecycleTone(lifecycle)}`}>
                              Credential lifecycle: {expired ? "Expired — verification or recovery required" : lifecycle ? label(lifecycle) : "Not evaluated"}
                            </p>
                            <p className="mt-1">
                              Expires: {Number.isFinite(expiryTime) ? new Date(expiryTime).toLocaleString() : "provider did not report a valid expiry"}
                            </p>
                            {expired ? <p className="mt-1 text-amber-100">The saved expiry has passed. A previous connected state or identity check is not evidence of current access.</p> : null}
                            {currentIdentity ? <p role="status" className="mt-1 text-white/80">Read-only identity check: {currentIdentity.healthy ? "Passed" : "Failed"} · {new Date(currentIdentity.checkedAt).toLocaleString()} — does not certify publishing permission.</p> : null}
                            {lifecycle === "EXPIRY_UNKNOWN" ? (
                              <p className="mt-1 text-amber-100">
                                Token expiry is unknown. A passing live check confirms current access only.
                              </p>
                            ) : null}
                            <p className="mt-1">
                              Refresh credential: {refreshTokenPresent === true ? "stored encrypted" : "not available"}
                            </p>
                            <p className="mt-1">
                              Granted scopes: {connector.grantedScopes.join(", ") || "not returned by provider"}
                            </p>
                            <p className="mt-1">
                              Last health record: {connector.lastHealthAt ? new Date(connector.lastHealthAt).toLocaleString() : "not recorded"}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {(connector.provider === "META" || connector.provider === "X") && <button type="button" onClick={() => void verifyIdentity(connector)}
                              disabled={busy || loading}
                              className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50">
                              {checkingIdentity === connector.id ? "Verifying identity…" : "Verify identity (read-only)"}
                            </button>}
                            <button
                              type="button"
                              onClick={() => void checkCredentialHealth(connector)}
                              disabled={busy || loading}
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {checkingHealth === connector.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Check credential health
                            </button>
                            <button
                              type="button"
                              onClick={() => void disconnect(connector)}
                              disabled={busy || loading}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-300/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {disconnecting === connector.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link2Off className="h-3.5 w-3.5" />
                              )}
                              Delete stored authorization
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => connect(provider)}
                disabled={!canLoad || !provider.readyToAuthorize || loading || busy}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
              >
                {providerConnectors.length > 0 ? "Authorize another account" : "Authorize account"}
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-white/40">
        Account authorization stores credentials for later approved operations. Verify identity performs a read-only account check. Credential health checks
        may rotate an expiring access token after confirmation, but they do not enable publishing; all global and
        provider-specific live gates remain separate and disabled.
      </p>
    </section>
  );
}
