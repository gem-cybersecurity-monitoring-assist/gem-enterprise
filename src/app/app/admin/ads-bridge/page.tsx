"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BridgePlan {
  versionHash: string;
  readiness: {
    draft: "READY";
    organicHandoff: "READY_FOR_REVIEW";
    paidDelivery: "BLOCKED";
    blockers: string[];
  };
  safeguards: {
    billingConfigured: false;
    providerWriteEnabled: false;
    externalActionTaken: false;
    automaticPublishing: false;
    approvalRequired: true;
  };
  adsManagerHandoff: {
    advertiserName: string;
    offerName: string;
    title: string;
    body: string;
    targetUrl: string;
    creativePath: string;
    market: "US";
    objective: "CLICKS";
    status: "PAUSED";
    budgetUsd: 0;
    syncMode: "PREVIEW_ONLY";
  };
  organicPackage: {
    targets: string[];
    state: "DRAFT";
    approvalRequired: true;
    complianceReviewRequired: true;
  };
}

export default function AdsBridgePage() {
  const [plan, setPlan] = useState<BridgePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ads-bridge", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Ads Bridge");
      setPlan(payload.plan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Ads Bridge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Zero-spend campaign control
          </div>
          <h1 className="text-2xl font-bold text-white">GEM Ads Bridge</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Preserve, validate, and hand off GEM advertising creative without enabling billing or making an external provider write.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPlan}
          disabled={loading}
          className="border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Validate package
        </Button>
      </div>

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-semibold text-yellow-400">Paid delivery remains provider-controlled</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          The bridge does not bypass advertising billing, identity review, account policy, or minimum-budget requirements. It keeps the paid handoff paused and prepares an approval-gated organic package.
        </p>
      </div>

      {error ? (
        <Card className="border-red-500/25 bg-red-500/10">
          <CardContent className="p-5 text-sm text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {loading && !plan ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Validating zero-spend package…
        </div>
      ) : null}

      {plan ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatusCard label="Draft package" value={plan.readiness.draft} ready />
            <StatusCard label="Organic handoff" value={plan.readiness.organicHandoff} ready />
            <StatusCard label="Paid delivery" value={plan.readiness.paidDelivery} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" /> Approved campaign package
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <Image
                    src={plan.adsManagerHandoff.creativePath}
                    alt="GEM Enterprise campaign creative"
                    width={1024}
                    height={1024}
                    className="aspect-square w-full object-cover"
                    priority
                  />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-500">{plan.adsManagerHandoff.offerName}</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{plan.adsManagerHandoff.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{plan.adsManagerHandoff.body}</p>
                </div>
                <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
                  <a href={plan.adsManagerHandoff.targetUrl} target="_blank" rel="noreferrer">
                    Open landing page <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/10 bg-card">
                <CardHeader><CardTitle className="text-sm text-white">Safety controls</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Control label="Budget" value="$0" />
                  <Control label="Status" value={plan.adsManagerHandoff.status} />
                  <Control label="Provider mode" value={plan.adsManagerHandoff.syncMode} />
                  <Control label="External action" value="NONE" />
                  <Control label="Billing configured" value="NO" />
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-card">
                <CardHeader><CardTitle className="text-sm text-white">Organic distribution draft</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {plan.organicPackage.targets.map((target) => (
                      <Badge key={target} className="border-cyan-500/25 bg-cyan-500/10 text-cyan-300">{target.replaceAll("_", " ")}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-slate-400">
                    Compliance review and explicit approval remain required before the existing social publishing system can queue this package.
                  </p>
                </CardContent>
              </Card>

              <p className="break-all text-xs font-mono text-slate-600">Version {plan.versionHash}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusCard({ label, value, ready = false }: { label: string; value: string; ready?: boolean }) {
  return (
    <Card className="border-white/10 bg-card">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-2 text-sm font-semibold ${ready ? "text-emerald-400" : "text-yellow-400"}`}>{value.replaceAll("_", " ")}</p>
      </CardContent>
    </Card>
  );
}

function Control({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-xs text-white">{value}</span>
    </div>
  );
}

