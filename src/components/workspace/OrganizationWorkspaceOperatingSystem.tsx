"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Plus, Send, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationWorkspaceCommandLayer } from "@/components/workspace/OrganizationWorkspaceCommandLayer";
import { WorkspaceOSModuleDirectory, type WorkspaceModuleItem } from "@/components/workspace/WorkspaceOSModuleDirectory";
import { WorkspaceProjectDirectory } from "@/components/workspace/WorkspaceProjectDirectory";

type Overview = Awaited<ReturnType<typeof import("@/lib/organizationWorkspace").getOrganizationWorkspaceOverview>>;

const field = "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300/25";

export function OrganizationWorkspaceOperatingSystem({
  overview,
  moduleItems,
}: {
  overview: Overview;
  moduleItems: WorkspaceModuleItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    updateId: string;
    decision: "APPROVED" | "RETURNED";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const reviewNoteRef = useRef<HTMLTextAreaElement>(null);
  const permits = (scope: string) => overview.workspace.permissions.some((permission) => permission.action === "manage" && permission.scope === scope);

  async function request(path: string, method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Operation failed");
      setNotice("Saved successfully.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function form(
    event: FormEvent<HTMLFormElement>,
    path: string,
    mapper: (data: FormData) => Record<string, unknown>,
  ) {
    event.preventDefault();
    const element = event.currentTarget;
    await request(path, "POST", mapper(new FormData(element)));
    element.reset();
  }

  async function review(updateId: string, decision: "APPROVED" | "RETURNED") {
    setReviewTarget({ updateId, decision });
    setReviewNote("");
    setReviewError(null);
  }

  async function submitReview() {
    if (!reviewTarget || busy) return;
    const note = reviewNote.trim();
    if (!note) {
      setReviewError(
        reviewTarget.decision === "APPROVED"
          ? "Add a short approval note before approving."
          : "Describe what must be corrected before returning.",
      );
      reviewNoteRef.current?.focus();
      return;
    }
    await request("/api/workspace/weekly-updates", "PATCH", {
      updateId: reviewTarget.updateId,
      workspaceId: overview.workspace.id,
      decision: reviewTarget.decision,
      reviewNote: note,
    });
    setReviewTarget(null);
    setReviewNote("");
  }

  const closeReview = useCallback(() => {
    if (busy) return;
    setReviewTarget(null);
    setReviewNote("");
    setReviewError(null);
  }, [busy]);

  useEffect(() => {
    if (!reviewTarget) return;
    reviewNoteRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeReview();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reviewTarget, closeReview]);

  return (
    <div className="space-y-6">
      {notice ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-cyan-100">
          {notice}
        </div>
      ) : null}

      <OrganizationWorkspaceCommandLayer
        workspaceId={overview.workspace.id}
        workspaceName={overview.workspace.name}
        projects={overview.projects}
        modules={overview.modules}
        updateCount={overview.updates.length}
      />

      <WorkspaceOSModuleDirectory items={moduleItems} workspaceId={overview.workspace.id} />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <WorkspaceProjectDirectory
          projects={overview.projects}
          emptyAction={
            permits("projects") ? (
              <a href="#add-project" className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Create the first project <Plus className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : undefined
          }
        />

        <div className="space-y-6">
          <Card id="workspace-team" className="scroll-mt-24 border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.members.length ? (
                overview.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{member.user.profile?.displayName || member.user.email}</p>
                      <p className="truncate text-xs text-slate-500">{member.user.email}</p>
                    </div>
                    <Badge variant="outline">{member.role?.name || "Member"}</Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
                  <p className="text-sm font-semibold text-white">No team members yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {permits("members")
                      ? "Assign an existing GEM member below to build this workspace's team."
                      : "Team assignment is handled by a workspace owner or administrator."}
                  </p>
                  {permits("members") ? (
                    <a href="#add-team-member" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                      Assign a team member <Send className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="workspace-weekly-reporting" className="scroll-mt-24 border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                Weekly reporting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.updates.length ? (
                overview.updates.slice(0, 5).map((update) => (
                  <div key={update.id} className="rounded-xl border border-white/10 p-4">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium text-white">Week ending {new Date(update.weekEnding).toLocaleDateString()}</p>
                      <Badge>{update.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{update.project?.name ?? "Organization-wide update"}</p>
                    {permits("weekly_updates") && update.status === "SUBMITTED" && update.authorUserId !== overview.viewerUserId ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={busy} onClick={() => review(update.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => review(update.id, "RETURNED")}>Return</Button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
                  <p className="text-sm font-semibold text-white">No weekly update submitted yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {permits("weekly_updates")
                      ? "Prepare the first update below to start the reporting cadence."
                      : "Weekly updates appear here once delivery begins."}
                  </p>
                  {permits("weekly_updates") ? (
                    <a href="#prepare-weekly-update" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                      Prepare an update <Send className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {permits("projects") ? (
          <Card id="add-project" className="scroll-mt-24 border-cyan-400/15 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => form(event, "/api/workspace/projects", (data) => ({
                  workspaceId: overview.workspace.id,
                  name: String(data.get("name")),
                  summary: String(data.get("summary")),
                  status: "PLANNED",
                  progress: 0,
                }))}
                className="space-y-3"
              >
                <input className={field} name="name" placeholder="Project name" minLength={2} required />
                <textarea className={field} name="summary" placeholder="Purpose, intended outcome, and setup state" minLength={10} required />
                <Button disabled={busy}>Create project</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {permits("members") ? (
          <Card id="add-team-member" className="scroll-mt-24 border-cyan-400/15 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-4 w-4" aria-hidden="true" />
                Add existing team member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => form(event, "/api/workspace/members", (data) => ({
                  workspaceId: overview.workspace.id,
                  email: String(data.get("email")),
                  confirmEmail: String(data.get("confirmEmail")),
                  roleId: String(data.get("roleId")),
                  reason: String(data.get("reason")),
                }))}
                className="space-y-3"
              >
                <input className={field} type="email" name="email" placeholder="Existing GEM member email" required />
                <input className={field} type="email" name="confirmEmail" placeholder="Confirm email exactly" required />
                <select className={field} name="roleId" required>
                  <option value="">Select workspace role</option>
                  {overview.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <textarea className={field} name="reason" placeholder="Reason for team access" minLength={12} required />
                <Button disabled={busy}>Assign team member</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {permits("weekly_updates") ? (
          <Card id="prepare-weekly-update" className="scroll-mt-24 border-cyan-400/15 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="h-4 w-4" aria-hidden="true" />
                Prepare weekly update
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => form(event, "/api/workspace/weekly-updates", (data) => ({
                  workspaceId: overview.workspace.id,
                  projectId: String(data.get("projectId")) || null,
                  weekEnding: String(data.get("weekEnding")),
                  accomplishments: String(data.get("accomplishments")),
                  inProgress: String(data.get("inProgress")),
                  blockers: String(data.get("blockers")) || null,
                  decisionsNeeded: String(data.get("decisionsNeeded")) || null,
                  nextPriorities: String(data.get("nextPriorities")),
                  submit: data.get("submit") === "on",
                }))}
                className="space-y-3"
              >
                <select className={field} name="projectId">
                  <option value="">Organization-wide</option>
                  {overview.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <input className={field} type="date" name="weekEnding" required />
                <textarea className={field} name="accomplishments" placeholder="Accomplishments" minLength={10} required />
                <textarea className={field} name="inProgress" placeholder="Work in progress" minLength={10} required />
                <textarea className={field} name="blockers" placeholder="Blockers, optional" />
                <textarea className={field} name="decisionsNeeded" placeholder="Decisions needed, optional" />
                <textarea className={field} name="nextPriorities" placeholder="Next-week priorities" minLength={10} required />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" name="submit" />
                  Submit for organization review
                </label>
                <Button disabled={busy}>Save weekly update</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card className="border-amber-400/15 bg-amber-400/[.03]">
        <CardContent className="flex gap-3 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <p className="font-semibold text-white">Controlled launch</p>
            <p className="mt-1 text-sm text-slate-400">
              This workspace is official and membership-scoped. Modules marked setup in progress or not activated are not represented as production-ready.
            </p>
          </div>
        </CardContent>
      </Card>

      {reviewTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeReview}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-review-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="weekly-review-title" className="text-base font-bold text-white">
                {reviewTarget.decision === "APPROVED" ? "Approve weekly update" : "Return weekly update"}
              </h2>
              <button
                type="button"
                onClick={closeReview}
                aria-label="Close review dialog"
                className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {reviewTarget.decision === "APPROVED"
                ? "The update will be marked approved and visible as reviewed. A short note is recorded with the decision."
                : "The update will be returned to the author. Describe clearly what must be corrected."}
            </p>
            <label htmlFor="weekly-review-note" className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Review note
            </label>
            <textarea
              id="weekly-review-note"
              ref={reviewNoteRef}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={4}
              placeholder={reviewTarget.decision === "APPROVED" ? "Approval note" : "What must be corrected?"}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300/25"
            />
            {reviewError ? (
              <p role="alert" className="mt-2 text-xs text-red-300">{reviewError}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeReview} disabled={busy} className="border-white/15 text-slate-300">
                Cancel
              </Button>
              <Button type="button" onClick={submitReview} disabled={busy} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                {busy ? "Saving…" : reviewTarget.decision === "APPROVED" ? "Approve update" : "Return update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
