"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Video,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { TikTokConnectionCheck } from "@/lib/tokmetric/oauth/health";

const WORKSPACE_ID = "ws_60488340ded94dcfab3b875ef9ae591c";
const CALLBACK_URL = "https://gemcybersecurityassist.com/api/tokmetric/oauth/callback";
const REVIEW_URL = "https://gemcybersecurityassist.com/tokmetric/app-review";
const PRIVACY_URL = "https://gemcybersecurityassist.com/tokmetric/privacy-policy";
const TERMS_URL = "https://gemcybersecurityassist.com/tokmetric/terms-of-service";
const OAUTH_URL = `/api/tokmetric/oauth/start?workspaceId=${WORKSPACE_ID}&provider=TIKTOK_CONTENT_POSTING_API`;
const STORAGE_KEY = "gem_tokmetric_submission_checklist_v1";

const APP_DESCRIPTION =
  "Alliance-Trust Hub is the GEM Enterprise web application for controlled TikTok content operations. Authorized users connect their own TikTok account through official OAuth, prepare and review video content, verify publishing settings and disclosures, approve the exact content version, and submit approved videos through TikTok’s Content Posting API. TikTok passwords are never collected, and access credentials remain encrypted on the server.";

const REVIEW_NOTES =
  "Alliance-Trust Hub uses TikTok Login Kit so a user can connect their own TikTok account through TikTok OAuth. The user.info.basic scope is used to show the connected creator identity. TokMetric uses the Content Posting API with video.publish only after the user selects an approved video, reviews privacy and interaction settings, confirms disclosures and media rights, and expressly submits the video. Sandbox demonstrations use SELF_ONLY privacy.";

type Tab = "submission" | "connection";

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

type Readiness = {
  livePublishingEnabled: boolean;
  workspaces: number;
  connectors: Array<{ state: string; _count: number }>;
  drafts: number;
  approvals: number;
  publishJobs: Array<{ internalState: string; externalState: string; _count: number }>;
  analytics: number;
  externalTruth: string;
};

const checklist = [
  { id: "secret-rotated", label: "Exposed TikTok client secret rotated and managed runtime updated" },
  { id: "icon", label: "1024 × 1024 application icon uploaded" },
  { id: "name", label: "Application name entered as Alliance-Trust Hub" },
  { id: "category", label: "Closest Business or Productivity category selected" },
  { id: "description", label: "Application description entered" },
  { id: "callback", label: "Exact production callback URL registered" },
  { id: "login-kit", label: "Login Kit product added" },
  { id: "content-posting", label: "Content Posting API — Direct Post added" },
  { id: "basic-scope", label: "user.info.basic scope requested" },
  { id: "publish-scope", label: "video.publish scope requested" },
  { id: "notes", label: "Product and scope explanation added" },
  { id: "demo", label: "Real end-to-end Sandbox recording prepared" },
] as const;

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function StatePill({ value, verified = false }: { value: string; verified?: boolean }) {
  const normalized = value.toUpperCase();
  const positive = ["CONNECTED", "READY", "PASS", "CONFIGURED", "AVAILABLE"].includes(normalized);
  const negative = ["ERROR", "FAILED", "TOKEN_EXPIRED"].includes(normalized);
  const classes = positive
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
    : negative
      ? "border-red-300/25 bg-red-300/10 text-red-200"
      : "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${classes}`}>
      {positive ? <CheckCircle2 className="h-3.5 w-3.5" /> : negative ? <XCircle className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {titleCase(value)}
      {verified ? " · verified" : ""}
    </span>
  );
}

function CopyField({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">{label}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-white/75">{value}</p>
          {note && <p className="mt-2 text-xs leading-5 text-white/40">{note}</p>}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.08]"
        >
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </article>
  );
}

export function TokMetricSetupStatus({ initialTab = "submission" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [healthRunning, setHealthRunning] = useState(false);
  const [checks, setChecks] = useState<TikTokConnectionCheck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      setChecked({});
    }
  }, []);

  const completed = useMemo(
    () => checklist.filter((item) => checked[item.id]).length,
    [checked],
  );

  const progress = Math.round((completed / checklist.length) * 100);

  function toggle(id: string) {
    setChecked((current) => {
      const next = { ...current, [id]: !current[id] };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function loadConnectionState(runHealth = false) {
    setError(null);
    setChecks([]);
    if (runHealth) setHealthRunning(true);
    else setLoading(true);
    try {
      if (runHealth) {
        const healthResponse = await fetch(
          `/api/tokmetric/connectors/health?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`,
          { method: "POST", cache: "no-store" },
        );
        const healthPayload = await healthResponse.json();
        if (!healthResponse.ok) {
          throw new Error(healthPayload.error?.message || healthPayload.error || "Connector health verification failed.");
        }
        setChecks(healthPayload.checks ?? []);
        if (!healthPayload.checks?.length) setError("No saved TikTok Content Posting accounts were available to verify.");
        return;
      }

      const [connectorResponse, readinessResponse] = await Promise.all([
        fetch(`/api/tokmetric/connectors?workspaceId=${encodeURIComponent(WORKSPACE_ID)}`, { cache: "no-store" }),
        fetch("/api/tokmetric/readiness", { cache: "no-store" }),
      ]);
      const [connectorPayload, readinessPayload] = await Promise.all([
        connectorResponse.json(),
        readinessResponse.json(),
      ]);
      if (!connectorResponse.ok) {
        throw new Error(connectorPayload.error?.message || connectorPayload.error || "Unable to load connector state.");
      }
      setConnectors(connectorPayload.connectors ?? []);
      if (!readinessResponse.ok) {
        throw new Error(readinessPayload.error?.message || readinessPayload.error || "Unable to load readiness state.");
      }
      setConnectors(connectorPayload.connectors ?? []);
      setReadiness(readinessPayload.readiness ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load setup status.");
    } finally {
      setLoading(false);
      setHealthRunning(false);
    }
  }

  useEffect(() => {
    if (tab === "connection") void loadConnectionState();
  }, [tab]);

  const postingConnector = connectors.find(
    (connector) => connector.provider === "TIKTOK_CONTENT_POSTING_API",
  );
  const connectedAccount = postingConnector?.accounts.find((account) => account.state === "CONNECTED") ?? postingConnector?.accounts[0];
  const requiredScopes = postingConnector?.requiredScopes ?? ["user.info.basic", "video.publish"];
  const grantedScopes = connectedAccount?.grantedScopes ?? [];
  const scopesReady = requiredScopes.every((scope) => grantedScopes.includes(scope));
  const missingConfiguration = postingConnector?.configurationMissing ?? [];
  const latestCheck = checks.find(check => check.connectorId === connectedAccount?.id);
  const connectionReady = postingConnector?.state === "CONNECTED" && Boolean(connectedAccount) && scopesReady && missingConfiguration.length === 0 && latestCheck?.status === "verified";

  return (
    <div className="min-h-screen bg-[#081019] text-white">
      <header className="border-b border-white/[0.08] bg-[#0b131e]">
        <div className="mx-auto max-w-screen-xl px-4 py-9 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/tokmetric/dashboard" className="text-sm font-semibold text-white/50 hover:text-cyan-300">
              TokMetric dashboard
            </Link>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
              Canonical GEM configuration
            </span>
          </div>
          <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">TikTok setup status</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Portal checklist and verified connector state in one place.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
                This page adopts the useful operator flow from the Replit prototype while replacing manual connection claims with GEM database records, managed-configuration checks, encrypted OAuth credentials, and real connector health state.
              </p>
            </div>
            <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-50/75">
              <div className="mb-2 flex items-center gap-2 font-semibold text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                Activation boundary
              </div>
              Manual checklist progress is operator-confirmed. Saved OAuth state and live TikTok identity verification are separate. Publishing requires its own approval and evidence.
            </aside>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5 sm:max-w-xl">
          <button
            type="button"
            onClick={() => setTab("submission")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === "submission" ? "bg-cyan-300 text-[#071019]" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}
          >
            Submission package
          </button>
          <button
            type="button"
            onClick={() => setTab("connection")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === "connection" ? "bg-cyan-300 text-[#071019]" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}
          >
            Connection status
          </button>
        </div>

        {tab === "submission" ? (
          <div className="space-y-8">
            <section className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
                <div>
                  <h2 className="font-bold text-red-100">Rotate the exposed TikTok client secret before OAuth</h2>
                  <p className="mt-2 text-sm leading-6 text-red-50/65">
                    The earlier screenshot exposed the application secret. Regenerate it in TikTok for Developers and update only managed runtime secret storage. Do not place the replacement in chat, GitHub, screenshots, or browser code.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <CopyField label="Application name" value="Alliance-Trust Hub" />
              <CopyField label="Recommended category" value="Business / Productivity" note="Select the closest category TikTok currently offers." />
              <CopyField label="Application description" value={APP_DESCRIPTION} />
              <CopyField label="Production callback URL" value={CALLBACK_URL} note="Register this exact HTTPS value. Do not use a Replit development URL." />
              <CopyField label="Products" value={"Login Kit\nContent Posting API — Direct Post"} />
              <CopyField label="Scopes" value={"user.info.basic\nvideo.publish"} />
              <CopyField label="Review explanation" value={REVIEW_NOTES} />
              <CopyField label="Reviewer route" value={REVIEW_URL} note="Record the real OAuth and SELF_ONLY Sandbox flow from this route." />
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">Operator-confirmed portal checklist</p>
                  <h2 className="mt-2 text-2xl font-bold">{completed} of {checklist.length} completed</h2>
                  <p className="mt-2 text-sm text-white/45">These checkboxes do not claim TikTok verification. Connection status is validated separately.</p>
                </div>
                <span className="text-2xl font-bold text-cyan-300">{progress}%</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {checklist.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-4 text-sm leading-6 text-white/65">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.id])}
                      onChange={() => toggle(item.id)}
                      className="mt-1 h-4 w-4 accent-cyan-300"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#071019] hover:bg-cyan-200">
                  Open TikTok Developer Portal <ExternalLink className="h-4 w-4" />
                </a>
                <Link href="/tokmetric/app-review" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.06]">
                  Open real review route <Video className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <CopyField label="Privacy policy" value={PRIVACY_URL} />
              <CopyField label="Terms of service" value={TERMS_URL} />
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Verified backend state</p>
                <p className="mt-2 text-sm leading-6 text-white/55">Refresh reads saved GEM records. Verify checks the saved TikTok account identity through a read-only provider request. It does not confirm publishing readiness.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void loadConnectionState(false)}
                  disabled={loading || healthRunning}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh state
                </button>
                <button
                  type="button"
                  onClick={() => void loadConnectionState(true)}
                  disabled={loading || healthRunning}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-4 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12] disabled:opacity-50"
                >
                  {healthRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Verify connector health
                </button>
                <a href={OAUTH_URL} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#071019] hover:bg-cyan-200">
                  Connect TikTok <KeyRound className="h-4 w-4" />
                </a>
              </div>
            </section>

            {error && (
              <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-100">
                {error}
              </section>
            )}

            <section aria-live="polite" className="space-y-3">
              {checks.map(check => (
                <article key={check.connectorId} className="rounded-2xl border border-white/10 p-5 text-sm">
                  <p className={check.status === "verified" ? "text-emerald-200" : "text-amber-100"}>Live TikTok identity: {titleCase(check.status)}</p>
                  <p className="mt-2">{check.message}</p>
                  <p className="mt-2 text-xs text-white/45">Checked: {new Date(check.checkedAt).toLocaleString()}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Managed configuration</p>
                <div className="mt-4"><StatePill value={missingConfiguration.length === 0 && postingConnector ? "CONFIGURED" : "NOT_CONFIGURED"} verified /></div>
                <p className="mt-3 text-xs leading-5 text-white/40">{missingConfiguration.length ? missingConfiguration.join(", ") : "No required variable names reported missing."}</p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Saved OAuth authorization</p>
                <div className="mt-4"><StatePill value={postingConnector?.state ?? "NOT_CONFIGURED"} /></div>
                <p className="mt-3 text-xs leading-5 text-white/40">Environment: {postingConnector?.environment ?? "unknown"}</p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Required scopes</p>
                <div className="mt-4"><StatePill value={scopesReady ? "READY" : "AUTHORIZATION_REQUIRED"} verified /></div>
                <p className="mt-3 text-xs leading-5 text-white/40">Required: {requiredScopes.join(", ")}</p>
              </article>
              <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">Live publishing</p>
                <div className="mt-4"><StatePill value={readiness?.livePublishingEnabled ? "READY" : "BLOCKED"} verified /></div>
                <p className="mt-3 text-xs leading-5 text-white/40">Production publishing remains disabled until separate authorization.</p>
              </article>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">TikTok Content Posting connector</p>
                  <h2 className="mt-2 text-2xl font-bold">{postingConnector?.displayName ?? "Connector definition not loaded"}</h2>
                  <p className="mt-2 text-sm text-white/45">Workspace: <span className="font-mono text-xs">{WORKSPACE_ID}</span></p>
                </div>
                <StatePill value={latestCheck?.status ?? "NOT_CHECKED"} verified={latestCheck?.status === "verified"} />
              </div>

              {connectedAccount ? (
                <dl className="mt-6 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Connected account</dt>
                    <dd className="mt-2 font-semibold text-white/80">{connectedAccount.displayName || "Authorized TikTok account"}</dd>
                    <dd className="mt-1 font-mono text-xs text-white/40">{connectedAccount.externalAccountId ?? connectedAccount.id}</dd>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Granted scopes</dt>
                    <dd className="mt-2 text-sm text-white/70">{grantedScopes.join(", ") || "No scopes returned"}</dd>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Account state</dt>
                    <dd className="mt-2"><StatePill value={connectedAccount.state} verified /></dd>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/35">Last health check</dt>
                    <dd className="mt-2 text-sm text-white/70">{connectedAccount.lastHealthAt ? new Date(connectedAccount.lastHealthAt).toLocaleString() : "Not checked"}</dd>
                  </div>
                </dl>
              ) : (
                <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-5 text-sm leading-6 text-amber-50/70">
                  No authorized TikTok account record exists yet. Complete portal configuration, sign in to GEM, and use the official Connect TikTok action.
                </div>
              )}
            </section>

            {readiness && (
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Workspace operational counts</p>
                    <h2 className="mt-2 text-2xl font-bold">Database-backed readiness summary</h2>
                  </div>
                  <StatePill value={connectionReady ? "READY" : "BLOCKED"} verified />
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ["Workspaces", readiness.workspaces],
                    ["Drafts", readiness.drafts],
                    ["Approvals", readiness.approvals],
                    ["Publish state groups", readiness.publishJobs.length],
                    ["Analytics snapshots", readiness.analytics],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-white/35">{label}</p>
                      <p className="mt-2 text-2xl font-bold text-white/85">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-6 text-white/45">{readiness.externalTruth}</p>
              </section>
            )}

            <section className={`rounded-2xl border p-6 ${connectionReady ? "border-emerald-300/20 bg-emerald-300/[0.05]" : "border-amber-300/20 bg-amber-300/[0.05]"}`}>
              <div className="flex items-start gap-3">
                {connectionReady ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />}
                <div>
                  <h2 className="font-bold">{connectionReady ? "TikTok account identity verified" : "BLOCKED — TIKTOK CONNECTION NOT FULLY ACTIVATED"}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {connectionReady
                      ? "TikTok confirmed the saved account identity and the saved scopes are present. Keep publishing disabled until separate approval, review and publishing checks are complete."
                      : "Finish the portal checklist, ensure managed configuration is complete, and authorize the TikTok Sandbox account through official OAuth. No connected or published state is simulated."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
