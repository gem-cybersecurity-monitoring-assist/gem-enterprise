import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Users,
  Handshake,
  ArrowRight,
  Lock,
  Fingerprint,
  FileCheck,
} from "lucide-react";
import { PublicIntakeForm } from "@/components/intake/PublicIntakeForm";

export const metadata: Metadata = {
  title: "Community Application — GEM Enterprise",
  description:
    "Apply for future GEM Community qualification. Human review does not grant automatic membership or access.",
};

const principles = [
  {
    icon: Fingerprint,
    title: "Application review",
    body: "Applications are submitted for human consideration. Approval and a future membership service are not guaranteed.",
  },
  {
    icon: Lock,
    title: "Discretion by Default",
    body: "Applications follow the published privacy process. This page does not represent a currently active membership network.",
  },
  {
    icon: FileCheck,
    title: "Clear Standards",
    body: "Applications enter a separate Community review queue. Submission does not create a client account, entitlement, membership or guaranteed decision date.",
  },
];

const audience = [
  {
    icon: Users,
    label: "Operators",
    desc: "Founders and executives running substantive businesses.",
  },
  {
    icon: Handshake,
    label: "Investors",
    desc: "Principals deploying capital with discretion and scale.",
  },
  {
    icon: ShieldCheck,
    label: "Advisors",
    desc: "Specialists trusted by the above to close hard problems.",
  },
];

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-20 md:py-28 cyber-grid overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <Badge className="mb-6 border border-primary/30 bg-primary/10 text-primary font-mono text-xs tracking-widest uppercase">
            Community qualification · Future membership
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-balance">
            Apply for the Future <span className="text-gradient-primary">GEM Community</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty">
            A future network for operators, investors, and advisors. Apply for human qualification;
            submission does not grant membership, an account, or a guaranteed response time.
          </p>
        </div>
      </section>

      {/* Who this is for */}
      <section className="py-14 border-t border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {audience.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.label}
                  className="glass-panel rounded-xl border border-border/50 p-6 flex items-start gap-4"
                >
                  <div className="p-2 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{a.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <PublicIntakeForm kind="COMMUNITY" />
        </div>
      </section>

      {/* Principles */}
      <section className="py-16 md:py-20 bg-muted/20 border-t border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">How We Handle Your Application</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Membership is a trust arrangement. Here is what that means in practice.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="glass-panel rounded-xl border border-border/50 p-6"
                >
                  <div className="p-2 rounded-md bg-primary/10 border border-primary/20 w-fit mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <p className="text-sm text-muted-foreground mb-4">
              Prefer a direct conversation before applying?
            </p>
            <Link href="/enterprise/apply">
              <Button variant="outline" className="gap-2">
                Submit Enterprise Application <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
