"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Plus, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationWorkspaceCommandLayer } from "@/components/workspace/OrganizationWorkspaceCommandLayer";
import { WorkspaceOSModuleDirectory } from "@/components/workspace/WorkspaceOSModuleDirectory";
import { WorkspaceProjectDirectory } from "@/components/workspace/WorkspaceProjectDirectory";

type Overview = Awaited<ReturnType<typeof import("@/lib/organizationWorkspace").getOrganizationWorkspaceOverview>>;

const field = "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300/25";

export function OrganizationWorkspaceOperatingSystem({ overview }: { overview: Overview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    const reviewNote = window.prompt(decision === "APPROVED" ? "Approval note" : "What must be corrected?");
    if (reviewNote) {
      await request("/api/workspace/weekly-updates", "PATCH", {
        updateId,
        workspaceId: overview.workspace.id,
        decision,
        reviewNote,
      });
    }
  }

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

      <WorkspaceOSModuleDirectory modules={overview.modules} />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <WorkspaceProjectDirectory projects={overview.projects} />

        <div className="space-y-6">
          <Card id="workspace-team" className="scroll-mt-24 border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{member.user.profile?.displayName || member.user.email}</p>
                    <p className="truncate text-xs text-slate-500">{member.user.email}</p>
                  </div>
                  <Badge variant="outline">{member.role?.name || "Member"}</Badge>
                </div>
              ))}
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
                <p className="text-sm text-slate-400">No weekly update submitted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {permits("projects") ? (
          <Card className="border-cyan-400/15 bg-card">
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
          <Card className="border-cyan-400/15 bg-card">
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
          <Card className="border-cyan-400/15 bg-card">
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
    </div>
  );
}
