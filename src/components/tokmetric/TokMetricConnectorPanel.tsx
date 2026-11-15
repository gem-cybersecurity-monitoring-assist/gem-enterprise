"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { TikTokConnectionCheck } from "@/lib/tokmetric/oauth/health";

const REVIEW_WORKSPACE_ID = "ws_60488340ded94dcfab3b875ef9ae591c";

type ConnectorAccount = {
  id: string;
  displayName: string;
  state: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  lastHealthAt: string | null;
};

type Connector = {
  provider: string;
  displayName: string;
  state: string;
  requiredScopes: string[];
  environment: string;
  configurationMissing: string[];
  accounts: ConnectorAccount[];
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function healthLabel(value: string | null) {
  if (!value) return "Not checked";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unavailable";
}

export function TokMetricConnectorPanel() {
  const [workspaceId, setWorkspaceId] = useState(REVIEW_WORKSPACE_ID);
  const [reloadKey, setReloadKey] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<TikTokConnectionCheck[]>([]);
  const [checkError, setCheckError] = useState<string>();
  const checkController = useRef<AbortController | null>(null);
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    connectors: Connector[];
  }>({ loading: false, connectors: [] });
  const canLoad = useMemo(() => workspaceId.trim().length > 0, [workspaceId]);

  useEffect(() => {
    checkController.current?.abort();
    setChecking(false);
    setChecks([]);
    setCheckError(undefined);
    if (!canLoad) return;
    const controller = new AbortController();
    setState({ loading: true, connectors: [] });
    fetch(
      `/api/tokmetric/connectors?workspaceId=${encodeURIComponent(workspaceId.trim())}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message || payload.error || "Unable to load connectors.");
        }
        if (!controller.signal.aborted) setState({ loading: false, connectors: payload.connectors ?? [] });
      })
      .catch((error) => {
        if (!controller.signal.aborted && error.name !== "AbortError") {
          setState({ loading: false, connectors: [], error: error.message });
        }
      });
    return () => { controller.abort(); checkController.current?.abort(); };
  }, [canLoad, reloadKey, workspaceId]);

  async function verifyConnection() {
    const controller = new AbortController();
    checkController.current?.abort();
    checkController.current = controller;
    setChecking(true);
    setChecks([]);
    setCheckError(undefined);
    try {
      const response = await fetch(`/api/tokmetric/connectors/health?workspaceId=${encodeURIComponent(workspaceId.trim())}`, {
        method: "POST", cache: "no-store", signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to verify TikTok.");
      if (!controller.signal.aborted) {
        setChecks(payload.checks ?? []);
        if (!payload.checks?.length) setCheckError("No saved TikTok Content Posting accounts were available to verify.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setCheckError(error instanceof Error ? error.message : "Unable to verify TikTok.");
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }

  const oauthHref = `/api/tokmetric/oauth/start?workspaceId=${encodeURIComponent(
    workspaceId.trim(),
  )}&provider=TIKTOK_CONTENT_POSTING_API`;

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Saved authorization and live verification
          </p>
          <h2 className="mt-2 text-xl font-bold">Workspace TikTok connectors</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Saved authorization is shown below. Verify TikTok checks the existing Content Posting account identity with a read-only request. It does not publish content or confirm posting approval.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_auto_auto_auto_auto]">
          <input
            aria-label="TokMetric workspace ID"
            disabled={checking}
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            placeholder="workspace ID"
            className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={!canLoad || state.loading || checking}
            className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reload saved accounts
          </button>
          <button
            type="button"
            disabled={!canLoad || state.loading || checking || Boolean(state.error)}
            onClick={verifyConnection}
            className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50"
          >
            {checking ? "Verifying TikTok…" : "Verify TikTok"}
          </button>
          <a
            href="/tokmetric/setup-status"
            className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-2 text-center text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.12]"
          >
            Setup status
          </a>
          <a
            href={oauthHref}
            className="min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-center text-sm font-bold text-[#06111b] transition hover:bg-cyan-200"
          >
            Connect TikTok
          </a>
        </div>
      </div>

      <div aria-live="polite">
        {checking && <p className="mt-4 text-sm text-cyan-100">Checking saved TikTok account identity. No content is posted.</p>}
        {checkError && <p className="mt-4 text-sm text-amber-100">{checkError}</p>}
      </div>
      {!canLoad && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          No workspace selected. Connector state is not fabricated.
        </div>
      )}
      {state.loading && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          Loading real connector state…
        </div>
      )}
      {state.error && (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          {state.error}
        </div>
      )}
      {!state.loading && !state.error && canLoad && state.connectors.length === 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          No connector definitions were returned for this authorized workspace.
        </div>
      )}
      {state.connectors.length > 0 && (
        <div className="mt-4 grid gap-3">
          {state.connectors.map((connector) => (
            <article
              key={connector.provider}
              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{connector.displayName}</h3>
                  <p className="mt-1 text-xs text-white/45">
                    {connector.provider} · {connector.environment} · required scopes: {connector.requiredScopes.join(", ") || "none"}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
                  {label(connector.state)}
                </span>
              </div>

              {connector.configurationMissing.length > 0 && (
                <p className="mt-3 text-xs text-amber-100">
                  Missing managed configuration: {connector.configurationMissing.join(", ")}
                </p>
              )}

              {connector.accounts.length === 0 ? (
                <p className="mt-3 text-sm text-white/45">No authorized account records.</p>
              ) : (
                <div className="mt-4 grid gap-3">
                  {connector.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="grid gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-4 md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold text-white/80">
                          {account.displayName || "Authorized TikTok account"}
                        </p>
                        <p className="mt-1 font-mono text-xs text-white/40">
                          Account ID: {account.externalAccountId ?? account.id}
                        </p>
                        <p className="mt-2 text-xs text-white/45">
                          Granted scopes: {account.grantedScopes.join(", ") || "none returned"}
                        </p>
                      </div>
                      <div className="text-left text-xs text-white/45 md:text-right">
                        <p className="font-semibold uppercase tracking-[0.12em] text-white/70">
                          {label(account.state)}
                        </p>
                        <p className="mt-1">Saved authorization check: {healthLabel(account.lastHealthAt)}</p>
                        {checks.find(check => check.connectorId === account.id) ? checks.filter(check => check.connectorId === account.id).map(check => (
                          <div key={check.connectorId} className="mt-2 max-w-sm text-sm" role="status">
                            <p className={check.status === "verified" ? "text-emerald-200" : "text-amber-100"}>Live identity: {label(check.status)}</p>
                            <p className="mt-1">{check.message}</p>
                            <p className="mt-1 text-xs">Checked: {healthLabel(check.checkedAt)}</p>
                          </div>
                        )) : <p className="mt-2">Live identity: Not checked in this view</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
