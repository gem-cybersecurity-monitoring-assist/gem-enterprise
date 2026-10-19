"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeadphonesIcon,
  Loader2,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  serviceRequestPriorityIds,
  serviceRequestTypeCatalog,
  type ServiceRequestTypeId,
} from "@/lib/serviceRequestCatalog";

interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    billingPlan: string | null;
  };
  role: {
    name: string;
    description: string | null;
  };
}

interface ServiceRequestRecord {
  id: string;
  workspaceId: string | null;
  type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    organization: { id: string; name: string; slug: string };
  } | null;
}

interface RequestCenterResponse {
  requests?: ServiceRequestRecord[];
  workspaces?: WorkspaceSummary[];
  error?: string;
  code?: string;
}

type RequestTypeIcon = ComponentType<{ className?: string }>;

const requestTypeIcons: Record<ServiceRequestTypeId, RequestTypeIcon> = {
  portfolio_review: Briefcase,
  compliance_review: ShieldCheck,
  cyber_briefing: Shield,
  real_estate_trust: Building2,
  document_request: FileText,
  support: HeadphonesIcon,
};

function formatLabel(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(status: string) {
  const value = status.toLowerCase();
  if (["completed", "resolved", "closed"].includes(value)) {
    return "border-green-500/25 bg-green-500/15 text-green-400";
  }
  if (value === "in_progress") return "border-cyan-500/25 bg-cyan-500/15 text-cyan-400";
  if (value === "pending_info") {
    return "border-yellow-500/25 bg-yellow-500/15 text-yellow-400";
  }
  if (value === "cancelled") return "border-red-500/25 bg-red-500/15 text-red-400";
  return "border-white/10 bg-white/10 text-slate-300";
}

function priorityClass(priority: string) {
  if (priority === "high") return "text-yellow-400";
  if (priority === "medium") return "text-cyan-400";
  return "text-slate-400";
}

async function responseBody(response: Response): Promise<RequestCenterResponse> {
  try {
    return (await response.json()) as RequestCenterResponse;
  } catch {
    return {};
  }
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [scopeId, setScopeId] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ServiceRequestTypeId>(
    serviceRequestTypeCatalog[0].id,
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof serviceRequestPriorityIds)[number]>("medium");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = scopeId === "personal" ? "" : `?workspaceId=${encodeURIComponent(scopeId)}`;

    try {
      const response = await fetch(`/api/requests${query}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await responseBody(response);
      if (!response.ok) {
        setRequests([]);
        setError(data.error ?? "Service requests could not be loaded.");
        return;
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : []);
    } catch {
      setRequests([]);
      setError("Service requests could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const summary = useMemo(
    () => ({
      total: requests.length,
      open: requests.filter((item) => item.status === "open").length,
      inProgress: requests.filter((item) => item.status === "in_progress").length,
      completed: requests.filter((item) =>
        ["completed", "resolved", "closed"].includes(item.status),
      ).length,
    }),
    [requests],
  );

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === scopeId) ?? null;

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: scopeId === "personal" ? null : scopeId,
          type: selectedType,
          subject,
          description,
          priority,
        }),
      });
      const data = await responseBody(response);

      if (!response.ok) {
        setError(data.error ?? "The request was not submitted.");
        return;
      }

      setSubject("");
      setDescription("");
      setPriority("medium");
      setSuccess(
        scopeId === "personal"
          ? "Your personal service request was submitted. No response time is guaranteed by this form."
          : "Your workspace-scoped service request was submitted. No response time is guaranteed by this form.",
      );
      await loadRequests();
    } catch {
      setError("The request was not submitted. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  const cards = [
    {
      label: "Total Requests",
      value: summary.total,
      icon: ClipboardList,
      color: "text-cyan-400",
      background: "bg-cyan-500/10",
    },
    {
      label: "Open",
      value: summary.open,
      icon: AlertCircle,
      color: "text-yellow-400",
      background: "bg-yellow-500/10",
    },
    {
      label: "In Progress",
      value: summary.inProgress,
      icon: Loader2,
      color: "text-cyan-400",
      background: "bg-cyan-500/10",
    },
    {
      label: "Completed",
      value: summary.completed,
      icon: CheckCircle2,
      color: "text-green-400",
      background: "bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <ClipboardList className="h-3.5 w-3.5" /> Controlled Service Workflow
          </div>
          <h1 className="text-2xl font-bold text-white">Request Center</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Submit and track requests owned by your account. Workspace scope is available only for
            active workspace memberships and is revalidated by the server on every read and write.
          </p>
        </div>
        <Badge className="border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Membership validated
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, background }) => (
          <div key={label} className="glass-panel bento-card rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${background}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className={`text-3xl font-bold ${color}`}>{loading ? "—" : value}</p>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <Card className="border-white/10 bg-card">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="font-semibold text-white">Request scope</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Personal requests are visible only to your account. Workspace requests remain owned by
              your account and require an active membership in the selected workspace.
            </p>
          </div>
          <select
            value={scopeId}
            onChange={(event) => {
              setScopeId(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            className="min-w-64 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
            aria-label="Request scope"
          >
            <option value="personal">Personal — this account only</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.organization.name} — {workspace.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div aria-live="polite" className="space-y-3">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm text-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-green-400/25 bg-green-400/[0.07] p-4 text-sm text-green-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5 text-cyan-400" /> New Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitRequest} className="space-y-5">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <p className="font-semibold text-amber-100">Do not include sensitive values</p>
                    <p className="mt-1 text-xs leading-5 text-amber-50/70">
                      Never enter passwords, PINs, one-time codes, recovery phrases, private keys,
                      tokens, payment-card numbers, banking identifiers, or identity-document
                      numbers. This form is not monitored as an emergency channel.
                    </p>
                  </div>
                </div>
              </div>

              {selectedWorkspace ? (
                <div className="flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 text-sm text-cyan-50/80">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>
                    Submitting to <strong>{selectedWorkspace.organization.name}</strong> —{" "}
                    <strong>{selectedWorkspace.name}</strong> as {selectedWorkspace.role.name}.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  This request will remain personal to your account and will not be assigned to a
                  workspace.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {serviceRequestTypeCatalog.map(({ id, label, description: body }) => {
                  const Icon = requestTypeIcons[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedType(id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedType === id
                          ? "border-cyan-500/40 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <Icon className="mb-3 h-5 w-5 text-cyan-400" />
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
                    </button>
                  );
                })}
              </div>

              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
                placeholder="Short request title"
                minLength={3}
                maxLength={120}
                required
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
                placeholder="Describe the requested outcome and relevant non-sensitive context. Do not paste credentials, financial identifiers, or identity-document numbers."
                minLength={10}
                maxLength={3000}
                required
              />
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as (typeof serviceRequestPriorityIds)[number])
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High — not an emergency response commitment</option>
              </select>
              <Button
                type="submit"
                disabled={creating || subject.trim().length < 3 || description.trim().length < 10}
                className="w-full rounded-xl bg-cyan-400 text-black hover:bg-cyan-300"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {creating ? "Submitting Request" : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ClipboardList className="h-5 w-5 text-cyan-400" />
              {selectedWorkspace ? `${selectedWorkspace.name} Requests` : "Personal Requests"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">No requests exist in this scope.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{request.subject}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatLabel(request.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{request.workspace ? request.workspace.name : "Personal"}</span>
                        </div>
                      </div>
                      <Badge className={statusClass(request.status)}>
                        {formatLabel(request.status)}
                      </Badge>
                    </div>
                    <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">
                      {request.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                      <span className={priorityClass(request.priority)}>
                        {formatLabel(request.priority)} Priority
                      </span>
                      <span className="font-mono text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
