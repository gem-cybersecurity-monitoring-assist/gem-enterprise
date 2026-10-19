"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  sharedSocialPublishingProviders,
  socialPublishingJobStates,
  type SharedSocialPublishingProvider,
  type SocialPublishingJobState,
} from "@/lib/social-media/publishing/types";

type PublishingJob = {
  id: string;
  provider: SharedSocialPublishingProvider;
  connectorId: string;
  contentType: string;
  contentVersionHash: string;
  approvedVersionHash: string;
  approvalId: string;
  complianceReviewId: string;
  compliancePassed: boolean;
  state: SocialPublishingJobState;
  attemptCount: number;
  maxAttempts: number;
  scheduledFor: string | null;
  nextAttemptAt: string;
  completedAt: string | null;
  createdAt: string;
  externalPostUrl: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

type QueueResponse = {
  jobs?: PublishingJob[];
  error?: { message?: string };
};

const providerLabels: Record<SharedSocialPublishingProvider, string> = {
  FACEBOOK_PAGE: "Facebook Page",
  INSTAGRAM_PROFESSIONAL: "Instagram",
  X: "X",
  LINKEDIN_COMPANY: "LinkedIn",
  YOUTUBE: "YouTube",
  NEXTDOOR: "Nextdoor",
};

const terminalStates = new Set<SocialPublishingJobState>([
  "PUBLISHED",
  "FAILED",
  "DEAD_LETTER",
  "BLOCKED",
  "CANCELLED",
]);

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function shortHash(value: string) {
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
}

function stateTone(state: SocialPublishingJobState) {
  if (state === "PUBLISHED") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (state === "BLOCKED" || state === "FAILED" || state === "DEAD_LETTER") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }
  if (state === "RETRYING") return "border-orange-400/25 bg-orange-400/10 text-orange-200";
  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

export function SocialPublishingQueuePanel() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [jobs, setJobs] = useState<PublishingJob[]>([]);
  const [provider, setProvider] = useState<SharedSocialPublishingProvider | "ALL">("ALL");
  const [state, setState] = useState<SocialPublishingJobState | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const saved = window.localStorage.getItem("gem-social-workspace-id");
    if (saved) setWorkspaceId(saved);
  }, []);

  useEffect(() => {
    if (workspaceId.trim()) window.localStorage.setItem("gem-social-workspace-id", workspaceId.trim());
  }, [workspaceId]);

  async function loadQueue() {
    const selectedWorkspace = workspaceId.trim();
    if (!selectedWorkspace) {
      setError("Enter an authorized workspace ID to load its publishing queue.");
      setJobs([]);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/social-media/publishing/jobs?workspaceId=${encodeURIComponent(selectedWorkspace)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as QueueResponse;
      if (!response.ok) throw new Error(payload.error?.message || "Unable to load the publishing queue.");
      setJobs(payload.jobs ?? []);
    } catch (caught) {
      setJobs([]);
      setError(caught instanceof Error ? caught.message : "Unable to load the publishing queue.");
    } finally {
      setLoading(false);
    }
  }

  const filteredJobs = useMemo(
    () => jobs.filter((job) =>
      (provider === "ALL" || job.provider === provider) &&
      (state === "ALL" || job.state === state)),
    [jobs, provider, state],
  );

  const counts = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter((job) => !terminalStates.has(job.state)).length,
    blocked: jobs.filter((job) => ["BLOCKED", "FAILED", "DEAD_LETTER"].includes(job.state)).length,
    published: jobs.filter((job) => job.state === "PUBLISHED").length,
  }), [jobs]);

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Live queue evidence</p>
          <h2 className="mt-2 text-xl font-bold text-white">Cross-platform publishing queue</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Read the real governed queue for this workspace. This console cannot create, process, retry, or publish
            a job; external writes remain behind exact-version approval, compliance, connector, and emergency-lock gates.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <input
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            placeholder="workspace ID"
            autoComplete="off"
            className="min-w-64 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
          />
          <button
            type="button"
            onClick={() => void loadQueue()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Load queue
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Queue records", counts.total],
          ["Active", counts.active],
          ["Blocked or failed", counts.blocked],
          ["Published", counts.published],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/40">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{count}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
          Provider
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as SharedSocialPublishingProvider | "ALL")}
            className="mt-1 block rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white"
          >
            <option value="ALL">All providers</option>
            {sharedSocialPublishingProviders.map((value) => <option key={value} value={value}>{providerLabels[value]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50">
          State
          <select
            value={state}
            onChange={(event) => setState(event.target.value as SocialPublishingJobState | "ALL")}
            className="mt-1 block rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white"
          >
            <option value="ALL">All states</option>
            {socialPublishingJobStates.map((value) => <option key={value} value={value}>{readable(value)}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {!loading && jobs.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/45">
            Load a workspace to view its real queue. No queue state is inferred or fabricated.
          </div>
        ) : null}
        {!loading && jobs.length > 0 && filteredJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/45">
            No queue records match these filters.
          </div>
        ) : null}
        {filteredJobs.map((job) => {
          const exactVersionMatches = job.contentVersionHash === job.approvedVersionHash;
          return (
            <article key={job.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white">{providerLabels[job.provider]}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${stateTone(job.state)}`}>
                      {readable(job.state)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                      {readable(job.contentType)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDate(job.scheduledFor ?? job.nextAttemptAt)}</span>
                    <span>Attempts {job.attemptCount}/{job.maxAttempts}</span>
                    <span>Connector {shortHash(job.connectorId)}</span>
                  </div>
                </div>
                {job.externalPostUrl ? (
                  <a href={job.externalPostUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                    Verify published post <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-white/50">
                  <p className="font-semibold uppercase tracking-[0.1em] text-white/35">Exact version</p>
                  <p className={`mt-2 inline-flex items-center gap-1.5 ${exactVersionMatches ? "text-emerald-200" : "text-rose-200"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {exactVersionMatches ? "Approved hash matches" : "Hash mismatch"}
                  </p>
                  <p className="mt-1 font-mono">{shortHash(job.contentVersionHash)}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-white/50">
                  <p className="font-semibold uppercase tracking-[0.1em] text-white/35">Approval evidence</p>
                  <p className="mt-2">Approval {shortHash(job.approvalId)}</p>
                  <p className="mt-1">Review {shortHash(job.complianceReviewId)}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3 text-xs text-white/50">
                  <p className="font-semibold uppercase tracking-[0.1em] text-white/35">Provider result</p>
                  <p className="mt-2">{job.completedAt ? `Completed ${formatDate(job.completedAt)}` : "No completed external write"}</p>
                  {job.lastErrorMessage ? <p className="mt-1 text-rose-200">{job.lastErrorCode ? `${job.lastErrorCode}: ` : ""}{job.lastErrorMessage}</p> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
