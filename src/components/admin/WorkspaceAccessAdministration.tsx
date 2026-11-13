"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePermissionCatalog } from "@/lib/workspace-access-admin/catalog";
import type { WorkspaceAdministrationSnapshot } from "@/lib/workspace-access-admin/snapshot";

interface WorkspaceAccessAdministrationProps {
  initialSnapshot: WorkspaceAdministrationSnapshot;
}

type SnapshotWorkspace = WorkspaceAdministrationSnapshot["organizations"][number]["workspaces"][number] & {
  organizationName: string;
  organizationSlug: string;
};

type SnapshotMembership = SnapshotWorkspace["members"][number];
type SnapshotRole = SnapshotWorkspace["roles"][number];

const fieldClass =
  "h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15";

function displayName(user: WorkspaceAdministrationSnapshot["users"][number]) {
  return (
    user.profile?.displayName ||
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") ||
    user.email
  );
}

function MembershipEditor({
  membership,
  roles,
  busy,
  onUpdate,
}: {
  membership: SnapshotMembership;
  roles: SnapshotRole[];
  busy: boolean;
  onUpdate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [roleId, setRoleId] = useState(membership.role?.id ?? "");
  const [status, setStatus] = useState<"active" | "suspended">(
    membership.status === "suspended" ? "suspended" : "active",
  );
  const [confirmEmail, setConfirmEmail] = useState("");
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdate({
      membershipId: membership.id,
      expectedUpdatedAt: membership.updatedAt,
      confirmEmail,
      roleId: roleId || undefined,
      status,
      reason,
    });
    setConfirmEmail("");
    setReason("");
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold text-white">{displayName(membership.user)}</p>
          <p className="mt-1 text-xs text-slate-400">{membership.user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 text-slate-300">
              Account: {membership.user.role}
            </Badge>
            <Badge
              className={
                membership.status === "active"
                  ? "border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                  : "border border-amber-400/25 bg-amber-400/10 text-amber-300"
              }
            >
              {membership.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Version: {new Date(membership.updatedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="space-y-1.5 text-xs text-slate-400">
          Workspace role
          <select className={fieldClass} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-slate-400">
          Access state
          <select
            className={fieldClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "suspended")}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-slate-400">
          Confirm target email exactly
          <input
            className={fieldClass}
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={membership.user.email}
            required
          />
        </label>
        <label className="space-y-1.5 text-xs text-slate-400">
          Written reason
          <input
            className={fieldClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={12}
            maxLength={500}
            placeholder="Explain why this access change is required"
            required
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">
          Access removal suspends the membership. It does not delete the audit-relevant record.
        </p>
        <Button type="submit" disabled={busy} variant="outline" className="shrink-0 border-white/15">
          {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Apply reviewed change
        </Button>
      </div>
    </form>
  );
}

export function WorkspaceAccessAdministration({
  initialSnapshot,
}: WorkspaceAccessAdministrationProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const workspaces = useMemo<SnapshotWorkspace[]>(
    () =>
      snapshot.organizations.flatMap((organization) =>
        organization.workspaces.map((workspace) => ({
          ...workspace,
          organizationName: organization.name,
          organizationSlug: organization.slug,
        })),
      ),
    [snapshot],
  );

  const [roleWorkspaceId, setRoleWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleConfirmation, setRoleConfirmation] = useState("");
  const [roleReason, setRoleReason] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  const [assignmentWorkspaceId, setAssignmentWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [assignmentUserId, setAssignmentUserId] = useState(snapshot.users[0]?.id ?? "");
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentConfirmation, setAssignmentConfirmation] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Main Workspace");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [confirmOwnerEmail, setConfirmOwnerEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  const [provisionReason, setProvisionReason] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteConfirmEmail, setInviteConfirmEmail] = useState("");
  const [inviteOrganizationName, setInviteOrganizationName] = useState("");
  const [inviteWorkspaceName, setInviteWorkspaceName] = useState("Main Workspace");
  const [inviteProjectName, setInviteProjectName] = useState("");
  const [inviteProjectSummary, setInviteProjectSummary] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [issuedInvitation, setIssuedInvitation] = useState<{
    setupUrl: string;
    email: string;
    organizationName: string;
    expiresAt: string;
  } | null>(null);

  const roleWorkspace = workspaces.find((workspace) => workspace.id === roleWorkspaceId) ?? null;
  const assignmentWorkspace =
    workspaces.find((workspace) => workspace.id === assignmentWorkspaceId) ?? null;
  const assignmentRoles = assignmentWorkspace?.roles ?? [];
  const assignmentUser = snapshot.users.find((user) => user.id === assignmentUserId) ?? null;

  async function refreshSnapshot() {
    const response = await fetch("/api/admin/workspace-access", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to refresh workspace access data.");
    setSnapshot(data);
  }

  async function mutate(method: "POST" | "PATCH", payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/workspace-access", {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Workspace access update failed.");
      await refreshSnapshot();
      setNotice({ kind: "success", message: success });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Workspace access update failed.",
      });
      throw error;
    } finally {
      setBusy(false);
    }
  }

  function togglePermission(key: string) {
    setPermissionKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  }

  async function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(
      "POST",
      {
        operation: "create_role",
        workspaceId: roleWorkspaceId,
        confirmWorkspaceSlug: roleConfirmation,
        name: roleName,
        description: roleDescription || null,
        permissions: permissionKeys.map((key) => {
          const [scope, action] = key.split(":");
          return { action, scope };
        }),
        reason: roleReason,
      },
      "Workspace role created and recorded in the audit log.",
    );
    setRoleName("");
    setRoleDescription("");
    setRoleConfirmation("");
    setRoleReason("");
    setPermissionKeys([]);
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(
      "POST",
      {
        operation: "assign_membership",
        workspaceId: assignmentWorkspaceId,
        confirmWorkspaceSlug: assignmentConfirmation,
        userId: assignmentUserId,
        confirmEmail: assignmentEmail,
        roleId: assignmentRoleId,
        reason: assignmentReason,
      },
      "Workspace membership assigned and recorded in the audit log.",
    );
    setAssignmentEmail("");
    setAssignmentConfirmation("");
    setAssignmentReason("");
  }

  async function submitProvisioning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate("POST", { operation:"provision_organization", organizationName, workspaceName, ownerEmail, confirmOwnerEmail, projectName:projectName||null, projectSummary:projectSummary||null, reason:provisionReason }, "Organization workspace provisioned for the existing member and recorded in the audit log.");
    setOrganizationName(""); setWorkspaceName("Main Workspace"); setOwnerEmail(""); setConfirmOwnerEmail(""); setProjectName(""); setProjectSummary(""); setProvisionReason("");
  }

  async function submitOwnerInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setIssuedInvitation(null);
    try {
      const response = await fetch("/api/admin/workspace-invitations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: inviteFirstName,
          lastName: inviteLastName,
          email: inviteEmail,
          confirmEmail: inviteConfirmEmail,
          organizationName: inviteOrganizationName,
          workspaceName: inviteWorkspaceName,
          projectName: inviteProjectName || null,
          projectSummary: inviteProjectSummary || null,
          reason: inviteReason,
          expiresMinutes: 1440,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        setupUrl?: string;
        invitation?: {
          email?: string;
          organizationName?: string;
          expiresAt?: string;
        };
      };
      if (
        !response.ok ||
        !data.setupUrl ||
        !data.invitation?.email ||
        !data.invitation.organizationName ||
        !data.invitation.expiresAt
      ) {
        throw new Error(data.error ?? "Workspace owner invitation could not be created.");
      }
      setIssuedInvitation({
        setupUrl: data.setupUrl,
        email: data.invitation.email,
        organizationName: data.invitation.organizationName,
        expiresAt: data.invitation.expiresAt,
      });
      setNotice({
        kind: "success",
        message: "One-time organization-owner invitation created. Copy it now; the capability is not stored in plaintext.",
      });
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInviteConfirmEmail("");
      setInviteOrganizationName("");
      setInviteWorkspaceName("Main Workspace");
      setInviteProjectName("");
      setInviteProjectSummary("");
      setInviteReason("");
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Workspace owner invitation could not be created.",
      });
    } finally {
      setBusy(false);
    }
  }

  const totalRoles = workspaces.reduce((sum, workspace) => sum + workspace.roles.length, 0);
  const totalMemberships = workspaces.reduce((sum, workspace) => sum + workspace.members.length, 0);

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_36%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <Badge className="border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
              <LockKeyhole className="mr-1.5 h-3.5 w-3.5" /> Platform Owner only
            </Badge>
            <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Workspace access administration</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Create controlled workspace roles, assign existing active accounts, and suspend or
              revise memberships. Every write requires confirmation and a written reason and is
              recorded in the administrator audit log.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 xl:min-w-[360px]">
            {[
              ["Workspaces", workspaces.length],
              ["Roles", totalRoles],
              ["Memberships", totalMemberships],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {notice && (
        <div
          className={
            notice.kind === "success"
              ? "flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4 text-sm text-emerald-100"
              : "flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm text-red-100"
          }
        >
          {notice.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice.message}
        </div>
      )}

      <Card className="border-amber-400/20 bg-amber-400/[0.035]">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-100">Human-initiated access only</p>
            <p className="mt-1 text-sm leading-6 text-amber-50/70">
              Deployment does not seed roles or assign users. This screen does not impersonate a
              client. Access removal suspends a membership rather than deleting its history.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-400/25 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <UserPlus className="h-4 w-4 text-cyan-300" /> Invite a new organization owner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm leading-6 text-slate-400">
            Creates a one-time setup link for a new client. Acceptance atomically creates the client
            account, organization, main workspace, Organization Owner role, membership, optional
            first project, and audit record. It cannot grant GEM administrator authority.
          </p>
          <form onSubmit={submitOwnerInvitation} className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">
              Owner first name
              <input className={fieldClass} autoComplete="off" value={inviteFirstName} onChange={(event) => setInviteFirstName(event.target.value)} required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Owner last name
              <input className={fieldClass} autoComplete="off" value={inviteLastName} onChange={(event) => setInviteLastName(event.target.value)} required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Owner email
              <input className={fieldClass} type="email" autoComplete="off" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Confirm owner email
              <input className={fieldClass} type="email" autoComplete="off" value={inviteConfirmEmail} onChange={(event) => setInviteConfirmEmail(event.target.value)} required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Organization name
              <input className={fieldClass} value={inviteOrganizationName} onChange={(event) => setInviteOrganizationName(event.target.value)} placeholder="Infinite Wealth & Well-Being" required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Workspace name
              <input className={fieldClass} value={inviteWorkspaceName} onChange={(event) => setInviteWorkspaceName(event.target.value)} required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              First project, optional
              <input className={fieldClass} value={inviteProjectName} onChange={(event) => setInviteProjectName(event.target.value)} placeholder="Infinite Wealth & Well-Being" />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">
              Written reason
              <input className={fieldClass} minLength={12} maxLength={500} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} placeholder="Approved organization-owner onboarding" required />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400 lg:col-span-2">
              Project summary, optional
              <textarea className={textareaClass} value={inviteProjectSummary} onChange={(event) => setInviteProjectSummary(event.target.value)} maxLength={2000} />
            </label>
            <div className="lg:col-span-2">
              <Button
                disabled={busy || !inviteEmail || inviteEmail.toLowerCase() !== inviteConfirmEmail.toLowerCase()}
                className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              >
                <UserPlus className="mr-2 h-4 w-4" /> Create protected owner invitation
              </Button>
            </div>
          </form>

          {issuedInvitation ? (
            <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-100">One-time setup link ready</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-50/70">
                    {issuedInvitation.email} · {issuedInvitation.organizationName} · expires {new Date(issuedInvitation.expiresAt).toLocaleString()}
                  </p>
                  <input
                    aria-label="One-time workspace setup link"
                    className={`${fieldClass} mt-3 font-mono text-xs`}
                    readOnly
                    value={issuedInvitation.setupUrl}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Send this link through your approved secure channel. Anyone holding it before expiry can complete the invited account, so do not place it in tickets, logs, or public messages.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-cyan-400/20 bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-white"><Building2 className="h-4 w-4 text-cyan-300" /> Provision an organization workspace</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm leading-6 text-slate-400">Creates an isolated organization, its main workspace, an Organization Owner role, optional first project, and membership for one existing active client account. It never creates credentials or a GEM platform administrator.</p>
          <form onSubmit={submitProvisioning} className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">Organization name<input className={fieldClass} value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="Infinite Wealth & Well-Being" required /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Workspace name<input className={fieldClass} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} required /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Existing member email<input className={fieldClass} type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} required /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Confirm member email<input className={fieldClass} type="email" value={confirmOwnerEmail} onChange={e=>setConfirmOwnerEmail(e.target.value)} required /></label>
            <label className="space-y-1.5 text-xs text-slate-400">First project, optional<input className={fieldClass} value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Infinite Wealth & Well-Being" /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Written reason<input className={fieldClass} value={provisionReason} onChange={e=>setProvisionReason(e.target.value)} minLength={12} maxLength={500} required /></label>
            <label className="space-y-1.5 text-xs text-slate-400 lg:col-span-2">Project summary, optional<textarea className={textareaClass} value={projectSummary} onChange={e=>setProjectSummary(e.target.value)} /></label>
            <div className="lg:col-span-2"><Button disabled={busy || ownerEmail.toLowerCase()!==confirmOwnerEmail.toLowerCase()} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Building2 className="mr-2 h-4 w-4" /> Provision reviewed workspace</Button></div>
          </form>
        </CardContent>
      </Card>

      {workspaces.length === 0 ? (
        <Card className="border-white/10 bg-card">
          <CardContent className="p-6 text-sm text-slate-400">
            No active workspace exists. Role and membership controls remain unavailable.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 2xl:grid-cols-2">
          <Card className="border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <KeyRound className="h-4 w-4 text-cyan-300" /> Create workspace role
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitRole} className="space-y-4">
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Workspace
                  <select className={fieldClass} value={roleWorkspaceId} onChange={(event) => setRoleWorkspaceId(event.target.value)}>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.organizationName} — {workspace.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-xs text-slate-400">
                    Role name
                    <input className={fieldClass} value={roleName} onChange={(event) => setRoleName(event.target.value)} minLength={2} maxLength={80} required />
                  </label>
                  <label className="block space-y-1.5 text-xs text-slate-400">
                    Confirm workspace slug: {roleWorkspace?.slug ?? "—"}
                    <input className={fieldClass} value={roleConfirmation} onChange={(event) => setRoleConfirmation(event.target.value)} required />
                  </label>
                </div>
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Description
                  <textarea className={textareaClass} value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} maxLength={300} />
                </label>
                <fieldset className="space-y-2">
                  <legend className="text-xs text-slate-400">Controlled permission set</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {workspacePermissionCatalog.map((permission) => {
                      const key = `${permission.scope}:${permission.action}`;
                      const label = permission.label || `${permission.action} ${permission.scope}`.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
                      const description = permission.description || `Allows ${permission.action} access within the ${permission.scope.replace(/_/g, " ")} scope only.`;
                      return (
                        <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                          <input type="checkbox" className="mt-1" checked={permissionKeys.includes(key)} onChange={() => togglePermission(key)} />
                          <span>
                            <span className="block text-sm font-medium text-white">{label}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Written reason
                  <textarea className={textareaClass} value={roleReason} onChange={(event) => setRoleReason(event.target.value)} minLength={12} maxLength={500} required />
                </label>
                <Button type="submit" disabled={busy || permissionKeys.length === 0} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Create reviewed role
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <UserPlus className="h-4 w-4 text-cyan-300" /> Assign workspace membership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitAssignment} className="space-y-4">
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Workspace
                  <select
                    className={fieldClass}
                    value={assignmentWorkspaceId}
                    onChange={(event) => {
                      setAssignmentWorkspaceId(event.target.value);
                      setAssignmentRoleId("");
                    }}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.organizationName} — {workspace.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Existing active user
                  <select className={fieldClass} value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)} required>
                    {snapshot.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {displayName(user)} — {user.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Workspace role
                  <select className={fieldClass} value={assignmentRoleId} onChange={(event) => setAssignmentRoleId(event.target.value)} required>
                    <option value="">Select a role</option>
                    {assignmentRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                {assignmentRoles.length === 0 && (
                  <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-100/80">
                    Create a controlled role for this workspace before assigning membership.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-xs text-slate-400">
                    Confirm target email: {assignmentUser?.email ?? "—"}
                    <input className={fieldClass} type="email" autoComplete="off" value={assignmentEmail} onChange={(event) => setAssignmentEmail(event.target.value)} required />
                  </label>
                  <label className="block space-y-1.5 text-xs text-slate-400">
                    Confirm workspace slug: {assignmentWorkspace?.slug ?? "—"}
                    <input className={fieldClass} value={assignmentConfirmation} onChange={(event) => setAssignmentConfirmation(event.target.value)} required />
                  </label>
                </div>
                <label className="block space-y-1.5 text-xs text-slate-400">
                  Written reason
                  <textarea className={textareaClass} value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} minLength={12} maxLength={500} required />
                </label>
                <Button type="submit" disabled={busy || !assignmentRoleId || !assignmentUserId} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  {busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Assign reviewed membership
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Users className="h-4 w-4 text-cyan-300" /> Existing memberships
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {workspaces.every((workspace) => workspace.members.length === 0) ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              No workspace membership exists. Deployment did not create one automatically.
            </div>
          ) : (
            workspaces.map((workspace) =>
              workspace.members.length > 0 ? (
                <section key={workspace.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{workspace.organizationName} — {workspace.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Workspace slug: {workspace.slug}</p>
                    </div>
                    <Badge variant="outline" className="border-white/15 text-slate-300">
                      {workspace.members.length} membership{workspace.members.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {workspace.members.map((membership) => (
                      <MembershipEditor
                        key={`${membership.id}:${membership.updatedAt}`}
                        membership={membership}
                        roles={workspace.roles}
                        busy={busy}
                        onUpdate={(payload) =>
                          mutate(
                            "PATCH",
                            payload,
                            "Workspace membership updated and recorded in the audit log.",
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
