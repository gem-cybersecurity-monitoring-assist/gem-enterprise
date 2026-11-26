import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Fingerprint,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Eligibility Status",
  description:
    "Review the GEM Enterprise qualified-client eligibility categories, access readiness, and onboarding status paths.",
};

const applicantTracks = [
  {
    icon: UserCheck,
    title: "Individual",
    subtitle: "Accredited Investor",
    status: "Eligible for review",
    description:
      "Individuals who may qualify through net worth, income history, or qualifying professional credentials.",
    checks: ["Identity verification", "Accredited investor certification", "Accepted jurisdiction review"],
  },
  {
    icon: Building2,
    title: "Business",
    subtitle: "Corporate Entity",
    status: "Eligible for review",
    description:
      "Registered entities seeking institutional-grade cybersecurity, financial security, or portfolio protection.",
    checks: ["Business registration", "Authorized signer", "Beneficial ownership disclosure"],
  },
  {
    icon: Shield,
    title: "Trust",
    subtitle: "Qualified Trust",
    status: "Eligible for review",
    description:
      "Trust structures with qualified trustees, documented beneficial interests, and compliant source-of-funds records.",
    checks: ["Trust agreement", "Trustee authority", "Beneficial interest documentation"],
  },
  {
    icon: Users,
    title: "Family Office",
    subtitle: "Single or Multi-Family Office",
    status: "Eligible for review",
    description:
      "Family office structures requiring multi-asset security, compliance, and operational risk management.",
    checks: ["AUM documentation", "Family office attestation", "Compliance contact"],
  },
  {
    icon: FileCheck2,
    title: "Institutional Client",
    subtitle: "Enterprise / Regulated Organization",
    status: "Eligible for review",
    description:
      "Regulated organizations, funds, advisors, and enterprise teams with formal approval authority.",
    checks: ["Institutional authorization", "Regulatory profile", "Security/compliance contact"],
  },
];

const workflow = [
  { label: "Access Request", body: "Applicant submits a dedicated enterprise qualification application, distinct from future Community membership." },
  { label: "Eligibility Screen", body: "GEM reviews category, jurisdiction, entity type, and baseline qualification." },
  { label: "KYC Intake", body: "Qualified applicants move into identity, entity, and documentation verification." },
  { label: "Compliance Review", body: "Compliance validates records, consent, source-of-funds, and risk indicators." },
  { label: "Entitlement Decision", body: "Approved clients receive protected portal access and service entitlements." },
];

export default function EligibilityStatusPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-24 md:py-32 cyber-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background" />
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 border border-primary/30 bg-primary/10 text-primary font-mono text-xs tracking-widest uppercase">
            Qualified Client Access
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Eligibility <span className="text-gradient-primary">Status</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Review every supported applicant track before entering KYC. GEM Enterprise uses gated access,
            compliance review, entitlement approval, and audit-ready operations for all qualified clients.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2 glow-cyan">
              <Link href="/enterprise/apply">
                Apply for Enterprise Services <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link href="/eligibility">View Full Requirements</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Applicant Tracks</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              These are the listed eligibility categories that should be visible before protected KYC status is required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {applicantTracks.map((track) => {
              const Icon = track.icon;
              return (
                <Card key={track.title} className="glass-panel bento-card border-border/50">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{track.title}</CardTitle>
                        <p className="text-xs text-primary font-mono mt-0.5">{track.subtitle}</p>
                      </div>
                    </div>
                    <CardDescription className="leading-relaxed pt-3">{track.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {track.status}
                    </div>
                    <ul className="space-y-2">
                      {track.checks.map((check) => (
                        <li key={check} className="flex gap-2 text-sm text-muted-foreground">
                          <Fingerprint className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/20 border-y border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-10">
            <Badge className="mb-4 border border-primary/30 bg-primary/10 text-primary font-mono text-xs tracking-widest uppercase">
              Operating Model
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From Access Request to Portal Entitlement</h2>
            <p className="text-muted-foreground">
              Public users see eligibility status first. Protected KYC application status becomes available after login and intake.
            </p>
          </div>
          <Separator className="mb-8" />
          <div className="space-y-4">
            {workflow.map((stage, index) => (
              <div key={stage.label} className="glass-panel rounded-xl border border-border/50 p-5 flex gap-4">
                <div className="h-10 w-10 rounded-full border border-primary/30 bg-primary/10 text-primary flex items-center justify-center font-mono text-sm flex-shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{stage.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{stage.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <div className="glass-panel rounded-2xl border border-primary/20 p-8 md:p-10">
            <Clock3 className="h-9 w-9 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Already submitted?</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Public eligibility status confirms whether your track is supported. Logged-in applicants can view protected KYC progress after onboarding begins.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="gap-2 glow-cyan">
                <Link href="/client-login">Client Login</Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/kyc/status">Protected KYC Status</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
