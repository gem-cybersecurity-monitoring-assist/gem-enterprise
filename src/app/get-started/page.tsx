import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, FileCheck2, LockKeyhole, Activity } from "lucide-react";

export const metadata = {
  title: "Get Started | GEM Enterprise",
  description: "Start a secure GEM Enterprise onboarding flow with eligibility review, KYC gating, and protected portal access.",
};

const eligibilitySignals = [
  "Regulated financial services, trust, family office, or real-asset operations",
  "Active cybersecurity, compliance, fraud, or digital-asset exposure",
  "Need for monitored onboarding, risk review, entitlement control, or secure client access",
];

const onboardingSteps = [
  {
    title: "Check eligibility status",
    description: "Review supported applicant tracks before entering a protected KYC workflow.",
    href: "/eligibility/status",
    icon: CheckCircle2,
  },
  {
    title: "Submit enterprise application",
    description: "Send a business or individual service request to the dedicated enterprise qualification queue for human review.",
    href: "/enterprise/apply",
    icon: FileCheck2,
  },
  {
    title: "Activate approved access or sign in",
    description: "After an approved review, a Platform Owner provides a one-time organization invitation. Existing clients can sign in and complete assigned verification.",
    href: "/client-login",
    icon: LockKeyhole,
  },
];

const operatingModel = [
  "Qualified client request",
  "Identity and entity verification",
  "Compliance review",
  "Entitlement approval",
  "Secure portal access",
  "Ongoing intelligence and audit trail",
];

export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/60 px-6 py-24 sm:py-28 lg:px-8 cyber-grid">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.12),transparent_30%)]" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Qualified Client Access
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Start with one controlled path into GEM Enterprise.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Review eligibility and submit a dedicated enterprise application. Human review and a secure owner-issued invitation precede account creation and workspace access.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/eligibility/status"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              Check Eligibility Status <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/client-login"
              className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              Client / Admin Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {onboardingSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Link key={step.title} href={step.href} className="group rounded-2xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur transition hover:border-primary/40 hover:bg-card">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mb-2 text-xs font-mono uppercase tracking-[0.22em] text-primary">Step {index + 1}</p>
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Operating model</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Built for gated, regulated access.
              </h2>
              <p className="mt-4 text-muted-foreground">
                GEM Enterprise records service applications for review. A submitted application does not create credentials, an approved account, paid access, a contract, or an active workspace. Account setup follows a separate authorized invitation.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {operatingModel.map((stage, index) => (
                <div key={stage} className="flex gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-mono text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium leading-6 text-foreground">{stage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-8">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Fit criteria</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Designed for serious operating environments.
              </h2>
              <p className="mt-4 text-muted-foreground">
                The onboarding flow preserves public discovery while keeping KYC, decisions, admin reviews, and portal entitlements inside authenticated control surfaces.
              </p>
            </div>
            <div className="space-y-4">
              {eligibilitySignals.map((signal) => (
                <div key={signal} className="flex gap-3 rounded-xl border border-border/60 bg-background/60 p-4">
                  <Activity className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm leading-6 text-muted-foreground">{signal}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
