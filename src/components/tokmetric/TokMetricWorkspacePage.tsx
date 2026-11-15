import Link from "next/link";
import { TokMetricConnectorPanel } from "./TokMetricConnectorPanel";
import { TikTokShopSellerPanel } from "./TikTokShopSellerPanel";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Code2,
  FileCheck2,
  History,
  KeyRound,
  LockKeyhole,
  Megaphone,
  RadioTower,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  Video,
} from "lucide-react";

export type TokMetricPageKind =
  | "dashboard"
  | "accounts"
  | "content"
  | "compliance"
  | "approvals"
  | "publishing"
  | "analytics"
  | "developer";

const pageMeta: Record<TokMetricPageKind, { title: string; eyebrow: string; summary: string }> = {
  dashboard: {
    title: "Command dashboard",
    eyebrow: "Workspace overview",
    summary:
      "Central view of connector state, approval readiness, compliance position, publishing blockers, and recent operational activity.",
  },
  accounts: {
    title: "Connected accounts",
    eyebrow: "OAuth and connector readiness",
    summary:
      "Review saved TikTok authorizations, verify account identity, and inspect the separate Shop and Business connection requirements.",
  },
  content: {
    title: "Content Studio",
    eyebrow: "Drafts, scripts, media, and scheduling",
    summary:
      "Plan scripts, captions, hashtags, media packages, thumbnails, schedules, and exact content versions before approval.",
  },
  compliance: {
    title: "Compliance Center",
    eyebrow: "Policy and safety review",
    summary:
      "Review commercial disclosures, claims, copyright, music rights, privacy settings, platform policies, and escalation requirements.",
  },
  approvals: {
    title: "Approval Center",
    eyebrow: "Human approval controls",
    summary:
      "Tie approval decisions to immutable content versions, hashes, budgets, account targets, and publishing settings.",
  },
  publishing: {
    title: "Publishing Queue",
    eyebrow: "Controlled external actions",
    summary:
      "Track scheduled jobs, required prerequisites, idempotency, external platform state, and blocked publishing attempts.",
  },
  analytics: {
    title: "Analytics",
    eyebrow: "Source-labeled reporting",
    summary:
      "Separate live platform data from seeded, manual, imported, calculated, or unknown analytics before reporting performance.",
  },
  developer: {
    title: "Developer Console",
    eyebrow: "OAuth, APIs, webhooks, and logs",
    summary:
      "Manage API readiness, callback requirements, webhook posture, rate limits, GPT Action readiness, and integration logs.",
  },
};

const nav: Array<{ href: string; label: string; kind: TokMetricPageKind }> = [
  { href: "/tokmetric/dashboard", label: "Dashboard", kind: "dashboard" },
  { href: "/tokmetric/accounts", label: "Accounts", kind: "accounts" },
  { href: "/tokmetric/content-studio", label: "Content Studio", kind: "content" },
  { href: "/tokmetric/compliance", label: "Compliance", kind: "compliance" },
  { href: "/tokmetric/approvals", label: "Approvals", kind: "approvals" },
  { href: "/tokmetric/publishing", label: "Publishing", kind: "publishing" },
  { href: "/tokmetric/analytics", label: "Analytics", kind: "analytics" },
  { href: "/tokmetric/developer", label: "Developer", kind: "developer" },
];

function Status({ value }: { value: string }) {
  const ready = ["READY", "PASS", "CONFIGURED", "AVAILABLE"].includes(value);
  const blocked = ["BLOCKED", "PENDING", "NOT_CONFIGURED", "AUTHORIZATION_REQUIRED", "APPROVAL_REQUIRED"].includes(value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
        ready
          ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
          : blocked
            ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
            : "border-white/10 bg-white/[0.04] text-white/55"
      }`}
    >
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {value}
    </span>
  );
}

const summaryCards = [
  { label: "OAuth connectors", value: "0", status: "AUTHORIZATION_REQUIRED", icon: KeyRound },
  { label: "Content drafts", value: "3", status: "AVAILABLE", icon: Video },
  { label: "Pending approvals", value: "2", status: "APPROVAL_REQUIRED", icon: UsersRound },
  { label: "External publishing", value: "Locked", status: "BLOCKED", icon: LockKeyhole },
];

const contentRows = [
  ["TokMetric product explainer", "Video", "DRAFT", "NOT_REVIEWED"],
  ["Cybersecurity awareness clip", "Script", "APPROVAL_REQUIRED", "PASS"],
  ["Compliance-first publishing", "Storyboard", "DRAFT", "HUMAN_REVIEW"],
];

const complianceRows = [
  ["Unsupported guarantee language", "High", "CHANGES_REQUIRED"],
  ["Commercial disclosure check", "Medium", "HUMAN_REVIEW"],
  ["Music and copyright evidence", "Medium", "PENDING"],
  ["Privacy and account safety", "Low", "PASS"],
];

const approvalRows = [
  ["ContentVersion tokmetric-explainer-v1", "Publisher", "APPROVAL_REQUIRED"],
  ["CampaignVersion launch-awareness-v1", "Administrator", "PENDING"],
  ["Ad budget request", "Advertising Manager", "BLOCKED"],
];

const publishRows = [
  ["TokMetric product explainer", "WAITING_FOR_APPROVAL", "No external submission"],
  ["Cybersecurity awareness clip", "BLOCKED", "Connector authorization required"],
  ["Compliance-first publishing", "QUEUED_INTERNAL", "Sandbox-only preparation"],
];

const analyticsRows = [
  ["Followers", "0", "UNKNOWN"],
  ["Video views", "0", "UNKNOWN"],
  ["Engagement rate", "0%", "CALCULATED"],
  ["Profile views", "0", "UNKNOWN"],
];

const developerRows = [
  ["OpenAPI action schema", "PARTIAL", "Schema prepared; backend functions pending"],
  ["GPT_AUTH_TOKEN", "CONFIGURED", "Private bearer token expected"],
  ["OAuth redirect URI", "NOT_CONFIGURED", "Requires TikTok Developer Portal value"],
  ["Webhooks", "NOT_CONFIGURED", "Signature verification required"],
  ["Rate limiting", "PENDING", "Required before external actions"],
];

function Table({ rows, headers }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
      <div className={`grid bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/35`} style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
        {headers.map((h) => <span key={h}>{h}</span>)}
      </div>
      {rows.map((row) => (
        <div key={row.join("-")} className="grid border-t border-white/[0.06] px-4 py-4 text-sm text-white/60" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
          {row.map((cell, index) => (
            <span key={`${cell}-${index}`} className={index === 0 ? "font-semibold text-white/80" : undefined}>
              {cell.includes("_") || ["PASS", "PENDING", "BLOCKED", "CONFIGURED", "PARTIAL", "UNKNOWN", "CALCULATED", "DRAFT"].includes(cell) ? <Status value={cell} /> : cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function PageBody({ kind }: { kind: TokMetricPageKind }) {
  if (kind === "accounts") return null;
  if (kind === "content") return <Table headers={["Asset", "Type", "State", "Compliance"]} rows={contentRows} />;
  if (kind === "compliance") return <Table headers={["Finding", "Risk", "Status"]} rows={complianceRows} />;
  if (kind === "approvals") return <Table headers={["Object", "Required role", "Status"]} rows={approvalRows} />;
  if (kind === "publishing") return <Table headers={["Job", "Internal state", "External state"]} rows={publishRows} />;
  if (kind === "analytics") return <Table headers={["Metric", "Value", "Source"]} rows={analyticsRows} />;
  if (kind === "developer") return <Table headers={["System", "Status", "Requirement"]} rows={developerRows} />;
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map(({ icon: Icon, label, value, status }) => (
        <article key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <Icon className="h-5 w-5 text-cyan-300" />
            <span className="text-2xl font-bold">{value}</span>
          </div>
          <h2 className="mt-5 font-semibold">{label}</h2>
          <div className="mt-3"><Status value={status} /></div>
        </article>
      ))}
    </div>
  );
}

const nextSteps = [
  "Connect real TikTok OAuth after developer app settings are approved.",
  "Add protected authenticated workspace records and database-backed workflows.",
  "Implement GPT Action backend endpoints before exposing assistant write actions.",
  "Record the review-demo page plus legal pages for the TikTok review video.",
];

export function TokMetricWorkspacePage({ kind }: { kind: TokMetricPageKind }) {
  const meta = pageMeta[kind];
  const accountSteps = [
    "Reload saved accounts to read the current authorized workspace records.",
    "Use Verify TikTok to check the saved Content Posting account identity.",
    "Review the dated live result separately from saved scopes and authorization.",
    "Keep publishing disabled until app review, content approval and publishing prerequisites are complete.",
  ];
  return (
    <div className="min-h-screen bg-[#091019] text-white">
      <header className="border-b border-white/[0.08] bg-[#0b121d]">
        <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/tokmetric" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-cyan-300">
            <ArrowRight className="h-4 w-4 rotate-180" />
            TokMetric product page
          </Link>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{meta.eyebrow}</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">{meta.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">{meta.summary}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-50/70">
              <div className="mb-2 flex items-center gap-2 font-semibold text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                {kind === "accounts" ? "Publishing safeguards" : "Pre-connection state"}
              </div>
              {kind === "accounts"
                ? "Account identity verification is read-only. Publishing requires separate scopes, platform approval and exact-content approval."
                : "External TikTok actions remain blocked until OAuth, scopes, and platform confirmation exist."}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-screen-xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside>
          <nav className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 lg:sticky lg:top-24">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 block rounded-xl px-3 py-2.5 text-sm transition ${item.kind === kind ? "bg-cyan-300 text-[#071019] font-semibold" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <Link href="/tokmetric/review-demo" className="block rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2.5 text-sm font-semibold text-cyan-200">
                App review demo
              </Link>
            </div>
          </nav>
        </aside>

        <section className="min-w-0 space-y-8">
          {(kind === "accounts" || kind === "developer" || kind === "dashboard") && <TokMetricConnectorPanel />}
          {(kind === "accounts" || kind === "developer" || kind === "dashboard") && <TikTokShopSellerPanel />}

          <PageBody kind={kind} />

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-bold">Operational guardrails</h2>
              </div>
              <ul className="space-y-3 text-sm leading-6 text-white/55">
                <li>• No TikTok password, cookie, session, access token, refresh token, or client secret is collected in the UI.</li>
                <li>• External write actions require OAuth authorization, scopes, compliance review, and human approval.</li>
                <li>• Internal states are never presented as confirmed TikTok publication.</li>
                <li>• Analytics must identify whether data is live, imported, seeded, manual, calculated, or unknown.</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-5 flex items-center gap-3">
                <History className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-bold">{kind === "accounts" ? "Connection review steps" : "Next build steps"}</h2>
              </div>
              <ul className="space-y-3 text-sm leading-6 text-white/55">
                {(kind === "accounts" ? accountSteps : nextSteps).map((step) => <li key={step}>• {step}</li>)}
              </ul>
            </article>
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/tokmetric/privacy-policy" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/[0.06]">Privacy Policy</Link>
              <Link href="/tokmetric/terms-of-service" className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/[0.06]">Terms of Service</Link>
              <Link href="/tokmetric/review-demo" className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#071019] hover:bg-cyan-200">Open review demo</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
