"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkspaceOption {
  id: string;
  name: string;
}

interface ExperianStatus {
  ok: true;
  readiness: {
    configured: boolean;
    environment: "sandbox" | "uat" | "production";
    authMode: "DEVELOPER_PASSWORD" | "AUTHORIZATION_CODE";
    missing: string[];
    storeProvisioned: boolean;
    consumerDelegationApproved: boolean;
    approvedCapabilities: string[];
  };
  connection: null | {
    state: string;
    authMode: string;
    environment: string;
    displayLabel: string;
    externalAccountReference: string | null;
    grantedScopes: string[];
    approvedCapabilities: string[];
    lastReadVerifiedAt: string | null;
    lastHealthAt: string | null;
    updatedAt: string;
  };
}

function errorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "The Experian request could not be completed.";
}

export function ExperianConnectionPanel() {
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState(searchParams.get("workspace") || "");
  const [status, setStatus] = useState<ExperianStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const callbackState = searchParams.get("connectionState");
  const isConnected = status?.connection?.state === "CONNECTED";

  const loadStatus = useCallback(async (selectedWorkspaceId: string) => {
    if (!selectedWorkspaceId) {
      setStatus(null);
      return;
    }
    const response = await fetch(
      `/api/integrations/experian/status?workspaceId=${encodeURIComponent(selectedWorkspaceId)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as ExperianStatus | unknown;
    if (!response.ok) throw new Error(errorMessage(payload));
    setStatus(payload as ExperianStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/workspaces", { cache: "no-store" });
        const payload = (await response.json()) as {
          workspaces?: WorkspaceOption[];
          selectedWorkspaceId?: string | null;
        };
        if (!response.ok) throw new Error(errorMessage(payload));
        if (cancelled) return;
        const available = payload.workspaces || [];
        const selected = workspaceId || payload.selectedWorkspaceId || available[0]?.id || "";
        setWorkspaces(available);
        setWorkspaceId(selected);
        await loadStatus(selected);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Workspace access failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadStatus, workspaceId]);

  const actionLabel = useMemo(() => {
    if (!status) return "Connect Experian";
    return status.readiness.authMode === "AUTHORIZATION_CODE"
      ? "Approve in Experian"
      : "Connect Experian API";
  }, [status]);

  async function runMutation(path: string, successMessage: string) {
    if (!workspaceId) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setMessage(successMessage);
      await loadStatus(workspaceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Experian request failed.");
    } finally {
      setWorking(false);
    }
  }

  function connect() {
    if (!workspaceId || !status?.readiness.configured) return;
    if (status.readiness.authMode === "AUTHORIZATION_CODE") {
      const redirectAfter = `/app/products/financial/credit-readiness?workspace=${encodeURIComponent(workspaceId)}`;
      window.location.assign(
        `/api/integrations/experian/start?workspaceId=${encodeURIComponent(workspaceId)}&redirectAfter=${encodeURIComponent(redirectAfter)}`,
      );
      return;
    }
    void runMutation("/api/integrations/experian/connect", "Experian API connected and read access verified.");
  }

  if (loading) {
    return (
      <Card className="border-white/10 bg-slate-900/50">
        <CardContent className="flex min-h-40 items-center justify-center text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Experian connection status…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {callbackState === "connected" ? (
        <div className="rounded-xl border border-green-400/25 bg-green-400/10 p-4 text-sm text-green-200">
          Experian returned successfully and the read verification passed.
        </div>
      ) : null}

      <Card className="border-white/10 bg-slate-900/50">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Link2 className="h-5 w-5 text-cyan-400" /> Experian account connection
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-slate-400">
                Authorize the approved Experian API product. GEM stores encrypted tokens and connection
                metadata only—not credit reports, scores, or identity-response bodies.
              </CardDescription>
            </div>
            <Badge
              className={
                isConnected
                  ? "border-green-500/30 bg-green-500/20 text-green-300"
                  : "border-amber-500/30 bg-amber-500/20 text-amber-300"
              }
            >
              {isConnected ? "Connected + read verified" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block text-sm font-medium text-slate-300">
            Workspace
            <select
              value={workspaceId}
              onChange={(event) => {
                const next = event.target.value;
                setWorkspaceId(next);
                setMessage(null);
                void loadStatus(next).catch((error) =>
                  setMessage(error instanceof Error ? error.message : "Status request failed."),
                );
              }}
              className="mt-2 h-11 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-white"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          {status ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusFact label="Environment" value={status.readiness.environment} />
              <StatusFact
                label="Authorization"
                value={
                  status.readiness.authMode === "AUTHORIZATION_CODE"
                    ? "Consumer approval"
                    : "Developer API"
                }
              />
              <StatusFact
                label="Read verification"
                value={
                  status.connection?.lastReadVerifiedAt
                    ? new Date(status.connection.lastReadVerifiedAt).toLocaleString()
                    : "Not verified"
                }
              />
              <StatusFact
                label="Approved capabilities"
                value={status.connection?.approvedCapabilities.join(", ") || "None declared"}
              />
            </div>
          ) : null}

          {status && !status.readiness.configured ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Provider activation is still locked.</p>
                  <p className="mt-1 text-amber-100/80">
                    Missing server configuration: {status.readiness.missing.join(", ")}.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {!isConnected ? (
              <Button
                onClick={connect}
                disabled={working || !workspaceId || !status?.readiness.configured}
                className="bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                {actionLabel}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={working}
                  onClick={() =>
                    void runMutation(
                      "/api/integrations/experian/verify",
                      "Experian read access was verified again.",
                    )
                  }
                  className="border-white/15 text-white hover:bg-white/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Verify read access
                </Button>
                <Button
                  variant="outline"
                  disabled={working}
                  onClick={() =>
                    void runMutation(
                      "/api/integrations/experian/disconnect",
                      "Experian credentials were removed from GEM.",
                    )
                  }
                  className="border-red-400/25 text-red-200 hover:bg-red-400/10"
                >
                  <Unlink className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              </>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
            A developer account authorizes your API application; it does not automatically expose a personal
            Experian membership profile. Consumer data access requires the specific Experian product and its
            user-permission flow.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}
