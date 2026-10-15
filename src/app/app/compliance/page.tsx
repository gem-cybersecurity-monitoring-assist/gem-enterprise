"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProfileResponse = {
  email?: string;
  createdAt?: string;
  kycStatus?: string;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    entityType?: string | null;
    accreditedStatus?: boolean | null;
  } | null;
};

type DocumentRow = {
  id: string;
  documentType: string;
  fileName: string;
  status: string;
  createdAt: string;
};

function formatLabel(value?: string | null) {
  if (!value) return "Not Available";
  return value.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function kycBadge(status?: string) {
  const value = status || "not_started";
  if (value === "approved") return "border-green-500/25 bg-green-500/15 text-green-400";
  if (value === "under_review" || value === "manual_review") return "border-yellow-500/25 bg-yellow-500/15 text-yellow-400";
  if (value === "rejected" || value === "expired") return "border-red-500/25 bg-red-500/15 text-red-400";
  return "border-white/10 bg-white/10 text-slate-300";
}

export default function CompliancePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/profile").then((response) => response.json()).catch(() => null),
      fetch("/api/documents").then((response) => response.json()).catch(() => null),
    ])
      .then(([profileData, docsData]) => {
        if (profileData) setProfile(profileData);
        if (Array.isArray(docsData?.documents)) setDocuments(docsData.documents);
      })
      .finally(() => setLoading(false));
  }, []);

  const kycStatus = profile?.kycStatus || "not_started";
  const docsCount = documents.length;
  const verifiedDocs = documents.filter((doc) => doc.status === "approved" || doc.status === "verified").length;
  const isApproved = kycStatus === "approved";

  const requirements = [
    { title: "Identity Verification", status: isApproved ? "Complete" : "Required", done: isApproved, icon: UserCheck },
    { title: "Supporting Documents", status: docsCount > 0 ? `${docsCount} On File` : "Required", done: docsCount > 0, icon: FileText },
    { title: "Compliance Review", status: isApproved ? "Approved" : formatLabel(kycStatus), done: isApproved, icon: ShieldCheck },
    { title: "Entitlement Activation", status: isApproved ? "Eligible" : "Pending Approval", done: isApproved, icon: LockKeyhole },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Compliance Control
          </div>
          <h1 className="text-2xl font-bold text-white">Compliance Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Review verification status, document readiness, disclosure posture, and entitlement readiness.
          </p>
        </div>
        <Badge className={kycBadge(kycStatus)}>{formatLabel(kycStatus)}</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading compliance state…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { label: "KYC Status", value: formatLabel(kycStatus), icon: UserCheck, color: "text-cyan-400", bg: "bg-cyan-500/10" },
              { label: "Documents", value: String(docsCount), icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Verified Docs", value: String(verifiedDocs), icon: FileCheck2, color: "text-green-400", bg: "bg-green-500/10" },
              { label: "Accredited", value: profile?.profile?.accreditedStatus ? "Yes" : "Pending", icon: ClipboardCheck, color: "text-yellow-400", bg: "bg-yellow-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="glass-panel bento-card rounded-xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {requirements.map(({ title, status, done, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${done ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                        <Icon className={`h-5 w-5 ${done ? "text-green-400" : "text-yellow-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="mt-1 text-sm text-slate-400">{status}</p>
                      </div>
                    </div>
                    {done ? (
                      <Badge className="border-green-500/25 bg-green-500/15 text-green-400"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete</Badge>
                    ) : (
                      <Badge className="border-yellow-500/25 bg-yellow-500/15 text-yellow-400"><AlertCircle className="mr-1 h-3.5 w-3.5" /> Action Needed</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                <p className="text-sm font-semibold text-cyan-400">Compliance Path</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  GEM Enterprise access is controlled through KYC, document readiness, compliance review, and entitlement activation.
                </p>
              </div>
              <Button asChild className="w-full rounded-xl bg-cyan-400 text-black hover:bg-cyan-300"><Link href="/kyc/status">View KYC Status</Link></Button>
              <Button asChild variant="outline" className="w-full rounded-xl border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"><Link href="/app/documents">Review Documents</Link></Button>
              <Button asChild variant="outline" className="w-full rounded-xl border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"><Link href="/app/requests?type=compliance_review">Request Compliance Review</Link></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
