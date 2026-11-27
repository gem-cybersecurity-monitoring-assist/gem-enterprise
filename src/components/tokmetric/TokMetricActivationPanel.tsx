"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Video,
} from "lucide-react";

const WORKSPACE_ID = "ws_60488340ded94dcfab3b875ef9ae591c";

type Connector = {
  id: string;
  provider: string;
  state: string;
  displayName: string;
  externalAccountId: string | null;
  grantedScopes: string[];
  lastHealthAt: string | null;
};

type ContentRecord = {
  id: string;
  title: string;
  state: string;
  currentVersionId: string | null;
  updatedAt: string;
};

type ApprovalRecord = {
  id: string;
  contentId: string | null;
  contentVersionId: string | null;
  requiredRole: string;
  state: string;
  expiresAt: string | null;
};

type Snapshot = {
  ok: true;
  workspace: {
    id: string;
    name: string;
    globalEmergencyLock: boolean;
    publishingDisabled: boolean;
    advertisingDisabled: boolean;
    shopWriteDisabled: boolean;
    connectorDisabled: boolean;
  };
  counts: {
    connectors: number;
    connectedConnectors: number;
    contents: number;
    approvedContents: number;
    pendingApprovals: number;
    publishJobs: number;
    analyticsSnapshots: number;
    activeGptCredentials: number;
  };
  activation: {
    productionActivation: "READY" | "BLOCKED";
    controlledWriteMode: string;
    oauthEnabled: boolean;
    livePublishingEnabled: boolean;
    connectedPublishingConnector: boolean;
    configMissing: string[];
    blockers: string[];
  };
  connectors: Connector[];
  contents: ContentRecord[];
  approvals: ApprovalRecord[];
  externalActionTaken: false;
};

type CommandError = { error?: string; code?: string };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function stateLabel(value: string) {
  return value.replaceAll("_", " ");
}

function StateBadge({ value }: { value: string }) {
  const ready = ["READY", "CONNECTED", "APPROVED", "PASS"].includes(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
        ready
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/25 bg-amber-500/10 text-amber-200"
      }`}
    >
      {ready ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      {stateLabel(value)}
    </span>
  );
}

export function TokMetricActivationPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [caption, setCaption] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tokmetric/command", {
        method: "GET",
        cache: "no-store",
      });
      const body = await readJson<Snapshot & CommandError>(response);
      if (!response.ok || body.ok !== true) {
        throw new Error(body.error || "TokMetric workspace could not be loaded.");
      }
      setSnapshot(body);
    } catch (requestError) {
      setSnapshot(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "TokMetric workspace could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function command(
    operation: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setWorking(`${operation}:${String(payload.contentId || payload.approvalId || "global")}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/tokmetric/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, ...payload }),
      });
      const body = await readJson<Record<string, unknown> & CommandError>(response);
      if (!response.ok) {
        throw new Error(body.error || "TokMetric operation failed.");
      }
      setNotice(successMessage);
      await load();
      return body;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "TokMetric operation failed.",
      );
      return null;
    } finally {
      setWorking(null);
    }
  }

  async function createDraft() {
    if (title.trim().length < 1) {
      setError("A draft title is required.");
      return;
    }
    const result = await command(
      "create_draft",
      {
        title: title.trim(),
        script: script.trim() || undefined,
        caption: caption.trim() || undefined,
      },
      "Internal TokMetric draft created. No external TikTok action occurred.",
    );
    if (result) {
      setTitle("");
      setScript("");
      setCaption("");
    }
  }

  function startOAuth(provider: string) {
    const params = new URLSearchParams({ workspaceId: WORKSPACE_ID, provider });
    window.location.assign(`/api/tokmetric/oauth/start?${params.toString()}`);
  }

  const publishingConnector = useMemo(
    () =>
      snapshot?.connectors.find(
        (connector) => connector.provider === "TIKTOK_CONTENT_POSTING_API",
      ) ?? null,
    [snapshot],
  );

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-card/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-violet-300" />
            <h2 className="text-lg font-bold text-white">Production activation console</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Work through the controlled activation sequence using real workspace records.
            Drafts, reviews, approvals, and preflight are internal. External TikTok
            publishing remains blocked until every activation gate passes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="mt-5 flex items-center gap-2 py-8 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading production workspace…
        </div>
      ) : snapshot ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Activation", snapshot.activation.productionActivation],
              ["Connected connectors", String(snapshot.counts.connectedConnectors)],
              ["Approved content", String(snapshot.counts.approvedContents)],
              ["Pending approvals", String(snapshot.counts.pendingApprovals)],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
                <div className="mt-3">
                  {label === "Activation" ? (
                    <StateBadge value={value} />
                  ) : (
                    <p className="text-2xl font-bold text-white">{value}</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-300" />
                <h3 className="font-semibold text-white">TikTok authorization</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                OAuth starts through GEM and stores tokens only in the encrypted backend.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => startOAuth("TIKTOK_LOGIN_KIT")}
                  disabled={snapshot.workspace.connectorDisabled}
                  className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Connect Login Kit
                </button>
                <button
                  type="button"
                  onClick={() => startOAuth("TIKTOK_CONTENT_POSTING_API")}
                  disabled={snapshot.workspace.connectorDisabled}
                  className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Connect Posting API
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {snapshot.connectors.length === 0 ? (
                  <p className="text-sm text-slate-500">No authorized TikTok connectors.</p>
                ) : (
                  snapshot.connectors.map((connector) => (
                    <div key={connector.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{connector.displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">{connector.provider}</p>
                      </div>
                      <StateBadge value={connector.state} />
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-cyan-300" />
                <h3 className="font-semibold text-white">Create internal content draft</h3>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Draft title"
                  maxLength={200}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                />
                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Script"
                  rows={5}
                  maxLength={10000}
                  className="resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                />
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Caption"
                  rows={3}
                  maxLength={2200}
                  className="resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={() => void createDraft()}
                  disabled={working !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black hover:bg-cyan-300 disabled:opacity-50"
                >
                  {working?.startsWith("create_draft") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  Create draft
                </button>
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-cyan-300" />
              <h3 className="font-semibold text-white">Content review and approval flow</h3>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.contents.length === 0 ? (
                <p className="py-5 text-sm text-slate-500">No content records exist yet.</p>
              ) : (
                snapshot.contents.map((content) => {
                  const approval = snapshot.approvals.find(
                    (item) => item.contentId === content.id,
                  );
                  return (
                    <div key={content.id} className="rounded-xl border border-white/8 p-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-white">{content.title}</p>
                          <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{content.id}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StateBadge value={content.state} />
                          <button
                            type="button"
                            onClick={() =>
                              void command(
                                "run_review",
                                { contentId: content.id },
                                "Compliance review completed.",
                              )
                            }
                            disabled={working !== null}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.05] disabled:opacity-50"
                          >
                            Run review
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void command(
                                "request_approval",
                                { contentId: content.id, requiredRole: "approver" },
                                "Human approval requested for the exact content version.",
                              )
                            }
                            disabled={working !== null}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.05] disabled:opacity-50"
                          >
                            Request approval
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void command(
                                "publish_preflight",
                                {
                                  contentId: content.id,
                                  connectorId: publishingConnector?.id,
                                },
                                "Publishing preflight completed. No external action occurred.",
                              )
                            }
                            disabled={working !== null}
                            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/15 disabled:opacity-50"
                          >
                            Preflight
                          </button>
                        </div>
                      </div>
                      {approval?.state === "APPROVAL_REQUIRED" ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                          <span className="text-xs text-slate-500">Approval {approval.id}</span>
                          <button
                            type="button"
                            onClick={() =>
                              void command(
                                "decide_approval",
                                { approvalId: approval.id, decision: "approve", reason: "Approved in the controlled GEM Command Center." },
                                "Exact-version approval recorded.",
                              )
                            }
                            disabled={working !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void command(
                                "decide_approval",
                                { approvalId: approval.id, decision: "reject", reason: "Rejected in the controlled GEM Command Center." },
                                "Approval rejection recorded.",
                              )
                            }
                            disabled={working !== null}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4" /> Activation blockers
            </div>
            {snapshot.activation.blockers.length === 0 ? (
              <p className="mt-3 text-sm text-emerald-200">All internal activation gates pass.</p>
            ) : (
              <ul className="mt-3 grid gap-2 text-sm text-amber-100/75 sm:grid-cols-2">
                {snapshot.activation.blockers.map((blocker) => (
                  <li key={blocker} className="rounded-lg border border-amber-500/15 bg-black/10 px-3 py-2">
                    {stateLabel(blocker)}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-100/60">
              <Send className="h-3.5 w-3.5" /> External actions taken: none
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
