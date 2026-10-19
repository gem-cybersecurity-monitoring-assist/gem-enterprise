"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mail, Plus, RefreshCw, ShieldCheck, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Campaign {
  id: string;
  title: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  createdAt: string;
}

const statusColor: Record<string, string> = {
  DRAFT: "border-slate-500/25 bg-slate-500/15 text-slate-300",
  SCHEDULED: "border-blue-500/25 bg-blue-500/15 text-blue-400",
  SENDING: "border-yellow-500/25 bg-yellow-500/15 text-yellow-400",
  SENT: "border-green-500/25 bg-green-500/15 text-green-400",
  CANCELLED: "border-red-500/25 bg-red-500/15 text-red-400",
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/campaigns");
      const data = await response.json();
      if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <Mail className="h-3.5 w-3.5" /> Campaign Governance
          </div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Review lifecycle campaigns, recipients, and send readiness. Sending remains an explicit approval-gated operation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchCampaigns} className="border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button asChild variant="outline" size="sm" className="border-white/10 text-slate-300 hover:bg-white/10 hover:text-white">
            <Link href="/app/admin/market/outreach"><Users className="mr-2 h-4 w-4" /> First-20 Outreach</Link>
          </Button>
          <Button asChild size="sm" className="bg-cyan-400 text-black hover:bg-cyan-300">
            <Link href="/app/admin/campaigns/new"><Plus className="mr-2 h-4 w-4" /> New Campaign</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-semibold text-yellow-400">Send approval gate active</p>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Campaign sends are intentionally not exposed as one-click actions here. Use explicit review and confirmation before triggering any send operation. The First-20 Outreach workbench is a separate one-to-one drafting surface and does not send or create intake records automatically.
        </p>
      </div>

      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <ShieldCheck className="h-4 w-4 text-cyan-400" /> Campaign Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No campaigns yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{campaign.title}</p>
                        <Badge className={`${statusColor[campaign.status] ?? "border-white/10 bg-white/10 text-slate-300"} text-xs`}>{campaign.status}</Badge>
                      </div>
                      <p className="truncate text-xs text-slate-500">{campaign.subject}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {campaign.sentAt
                          ? `Sent ${new Date(campaign.sentAt).toLocaleDateString()} · ${campaign.recipientCount} recipients`
                          : campaign.scheduledAt
                          ? `Scheduled for ${new Date(campaign.scheduledAt).toLocaleString()}`
                          : `Created ${new Date(campaign.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white">
                      <Link href="/app/admin/audit">Review Audit</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
