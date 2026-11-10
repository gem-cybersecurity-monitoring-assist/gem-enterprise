import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Eye,
  Target,
  Users,
  Globe,
  Scale,
  Cpu,
  TrendingUp,
  Home,
  Gavel,
  Settings,
  ArrowRight,
  CheckCircle2,
  Star,
  Lock,
  Award,
  Handshake,
  Building,
  Briefcase,
} from "lucide-react";

export const metadata: Metadata = { title: "Company | GEM Enterprise" };

const executives = [
  {
    name: "Executive Office & Governance",
    title: "Company-level strategic oversight",
    bio: "Defines enterprise direction, approves material decisions, and coordinates priorities between GEM Server Security, Alliance Trust Realty, and shared operations. Specific appointments require documentary confirmation.",
    initials: "EO",
  },
  {
    name: "Cybersecurity Leadership & Assurance",
    title: "Security and operational governance",
    bio: "Defines responsibilities for threat monitoring, control oversight, incident readiness and evidence review. The existence of this function does not establish a staffed security operations center or named officer.",
    initials: "CS",
  },
  {
    name: "Realty Advisory & Governance",
    title: "Alliance Trust Realty (ATR)",
    bio: "Coordinates realty service design, client disclosures, property documentation, and professional referral pathways. Any brokerage or agent activity depends on independently verified licensing.",
    initials: "ATR",
  },
  {
    name: "VIP & Client Relationship Desk",
    title: "Restricted executive service function",
    bio: "Outlines processes for priority client enquiries, confidential escalations and governance review. It is a service desk rather than a named board member and does not expose private client relationships.",
    initials: "VIP",
  },
];

const values = [
  {
    icon: Shield,
    title: "Integrity",
    description: "Every recommendation we make and every engagement we undertake is governed by an unwavering commitment to honesty. We will never recommend a course of action that conflicts with our clients' best interests or that compromises our independence.",
  },
  {
    icon: Eye,
    title: "Intelligence",
    description: "We operate from evidence, not assumption. Our analysts, advisors, and engineers are trained to think adversarially — anticipating threats before they materialize and grounding every decision in rigorous, current analysis of the threat landscape.",
  },
  {
    icon: Lock,
    title: "Independence",
    description: "GEM Enterprise is not a reseller or affiliate of any technology vendor. Our assessments and recommendations are entirely free from commercial incentives. What we advise is what we genuinely believe is correct for your organization.",
  },
  {
    icon: Award,
    title: "Accountability",
    description: "We stand behind every assessment, recommendation, and action. Our engagement structures include defined SLAs, formal deliverables, and named advisors — because accountability is not optional when organizations depend on us to be right.",
  },
];

const teams = [
  {
    icon: Cpu,
    name: "GEM Cybersecurity & Monitoring Assist",
    description: "The GEM cybersecurity operating model covers leadership, defensive monitoring, risk intelligence and documented response workflows. Individual staffing and live service coverage require independent verification.",
    capabilities: ["Security monitoring design", "Threat intelligence", "Incident readiness", "Risk reporting"],
  },
  {
    icon: Shield,
    name: "Threat Intelligence & Data Analysis",
    description: "Research and analysis functions intended to turn authorized information into defensible findings, source records and actionable security recommendations.",
    capabilities: ["Defensive intelligence", "Data analysis", "Evidence handling", "Research briefings"],
  },
  {
    icon: Scale,
    name: "Governance, Legal & Compliance",
    description: "Cross-division support for policy reviews, documented control evidence and compliance coordination, with regulated legal services limited to appropriately authorized professionals.",
    capabilities: ["Control documentation", "Legal coordination", "Audit readiness", "Privacy processes"],
  },
  {
    icon: Home,
    name: "Alliance Trust Realty (ATR)",
    description: "Property advisory, client-service and transaction-coordination functions subject to actual professional appointment, jurisdictional rules and applicable brokerage licensing.",
    capabilities: ["Client enquiries", "Property documentation", "Agent onboarding", "Advisory workflow"],
  },
  {
    icon: Settings,
    name: "Client Support & Enterprise Operations",
    description: "Shared service responsibilities for intake, case routing, escalations, business continuity and operations; staffing or service-level commitments must be established separately.",
    capabilities: ["Support intake", "Escalation records", "Client follow-up", "Operating procedures"],
  },
  {
    icon: Cpu,
    name: "Software Engineering & Cloud Operations",
    description: "Functional planning for software quality, platform maintenance, deployment review and incident response in the existing enterprise SaaS services.",
    capabilities: ["Software engineering", "Quality assurance", "Release controls", "Platform reliability"],
  },
  {
    icon: TrendingUp,
    name: "Financial & Affiliate Support",
    description: "Non-custodial administrative and affiliate-support coordination. This does not claim banking authority, investment management licenses or authorization to handle client funds.",
    capabilities: ["Documentation routing", "Risk escalation", "Operational reporting", "Compliance checks"],
  },
  {
    icon: Gavel,
    name: "People, Marketing & Business Coordination",
    description: "Planned cross-functional activities for onboarding, regional sales process design, brand communications, internal training and partner evidence review.",
    capabilities: ["People operations", "Brand content", "Sales coordination", "Partner review"],
  },
];

const partners = [
  {
    name: "National Cybersecurity Alliance",
    type: "Industry reference",
    description: "A public educational resource for cybersecurity awareness and organizational practices. GEM membership or partnership is not established by this listing.",
  },
  {
    name: "Financial Services Information Sharing and Analysis Center (FS-ISAC)",
    type: "Sector reference",
    description: "A recognized sector organization associated with financial threat-information sharing. No membership, feed access or data-sharing agreement is claimed here.",
  },
  {
    name: "American Land Title Association (ALTA)",
    type: "Realty reference",
    description: "An industry association relevant to title and settlement practices. No GEM/ATR membership or legal authority is implied.",
  },
  {
    name: "ISACA",
    type: "Governance reference",
    description: "Industry frameworks and professional development resources for governance, audit and security. This does not represent verified corporate membership.",
  },
  {
    name: "Association of Certified Fraud Examiners (ACFE)",
    type: "Professional reference",
    description: "Professional learning resources relevant to fraud examination. No GEM affiliate, certification or partnership status is asserted.",
  },
  {
    name: "Cloud Security Alliance (CSA)",
    type: "Security reference",
    description: "Cloud-security research and knowledge-sharing resources. This listing is not evidence of membership, sponsorship or partnership.",
  },
];

export default function CompanyPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-24 md:py-32 cyber-grid overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge className="mb-6 border border-primary/30 bg-primary/10 text-primary font-mono text-xs tracking-widest uppercase">
            Company Overview
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Built on Trust.{" "}
            <span className="text-gradient-primary">Driven by Intelligence.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            GEM Enterprise is developing a connected environment for cybersecurity, risk governance and responsible operational services, with each capability represented according to its documented readiness.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {[
              { label: "Leadership & Vision", href: "#leadership" },
              { label: "Leadership functions", href: "#board" },
              { label: "Teams", href: "#teams" },
              { label: "Industry references", href: "#partners" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-mono text-muted-foreground hover:text-primary transition-colors border border-border/50 hover:border-primary/50 px-3 py-1 rounded-full"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership & Vision */}
      <section id="leadership" className="py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Leadership & Vision</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Mission, vision, and the values that define how we operate</p>
            </div>
          </div>
          <Separator className="mb-12" />

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card className="glass-panel border-primary/20 bento-card">
              <CardHeader>
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-3">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Our Mission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  To provide institutional-grade cybersecurity, financial security, and operational protection
                  to qualified enterprises and accredited clients — enabling them to operate with confidence
                  in an environment of persistent and evolving threats. We exist to be the security partner
                  that organizations depend on when the stakes are highest.
                </p>
              </CardContent>
            </Card>
            <Card className="glass-panel border-primary/20 bento-card">
              <CardHeader>
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-3">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Our Vision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  A world where qualified organizations have access to the same caliber of security intelligence
                  and operational expertise historically reserved for national governments and the largest
                  global institutions — delivered with transparency, accountability, and precision. We are
                  building toward a future where enterprise security excellence is not a privilege of scale.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Values */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Star className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold">Company Values</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <Card key={value.title} className="glass-panel bento-card border-border/50">
                    <CardHeader>
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{value.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Executive Board */}
      <section id="board" className="py-20 md:py-28 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Briefcase className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Leadership &amp; Oversight Functions</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Organizational functions and responsibilities; named appointments require separate confirmation</p>
            </div>
          </div>
          <Separator className="mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {executives.map((exec) => (
              <Card key={exec.name} className="glass-panel bento-card border-border/50">
                <CardContent className="pt-6">
                  <div className="flex gap-5">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <span className="font-mono font-bold text-primary text-lg">{exec.initials}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg leading-tight">{exec.name}</h3>
                      <p className="text-primary text-sm font-mono mt-0.5 mb-3">{exec.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{exec.bio}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Teams */}
      <section id="teams" className="py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Enterprise teams &amp; professional functions</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Explore how GEM Enterprise disciplines coordinate services and governance</p>
            </div>
          </div>
          <Separator className="mb-12" />
          <div className="space-y-5">
            {teams.map((team) => {
              const Icon = team.icon;
              return (
                <Card key={team.name} className="glass-panel bento-card border-border/50">
                  <CardContent className="pt-6 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      <div className="md:col-span-3 flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base">{team.name}</h3>
                        </div>
                      </div>
                      <div className="md:col-span-6">
                        <p className="text-muted-foreground text-sm leading-relaxed">{team.description}</p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wide mb-2">
                          Capabilities
                        </p>
                        <ul className="space-y-1.5">
                          {team.capabilities.map((cap) => (
                            <li key={cap} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                              {cap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-9 flex flex-col gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <h3 className="text-lg font-semibold text-white">Meet approved professionals</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Our public personnel directory is separate from the internal team-media gallery.
                Individual photographs, professional identities and credentials are displayed
                only when their records are verified and approved for website publication.
              </p>
            </div>
            <Link
              href="/personnel"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              View approved directory <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Partners & Trustees */}
      <section id="partners" className="py-20 md:py-28 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Handshake className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Industry Standards &amp; Professional References</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Reference organizations and resources; no membership or partnership is asserted without evidence</p>
            </div>
          </div>
          <Separator className="mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <Card key={partner.name} className="glass-panel bento-card border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0 mt-0.5">
                      <Building className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="text-xs font-mono mb-2">{partner.type}</Badge>
                      <CardTitle className="text-sm font-semibold leading-tight">{partner.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">{partner.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 glass-panel rounded-xl p-5 border-border/30 text-center">
            <Globe className="h-4 w-4 text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
              These reference organizations are not identified as GEM Enterprise partners, trustees, sponsors or members.
              Any verified relationship or professional affiliation requires supporting records and permission before publication.
            </p>
          </div>
        </div>
      </section>

      {/* Compliance Notice */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="glass-panel border-primary/20">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0 mt-0.5">
                    <Scale className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Compliance & Regulatory Disclosure</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      GEM Enterprise operates under applicable federal and state regulations. All client engagements
                      are subject to eligibility review, KYC/AML screening, and jurisdictional compliance requirements.
                      Our services are available to qualified institutions and accredited individuals only. Review
                      our full compliance notice for complete regulatory disclosures.
                    </p>
                  </div>
                </div>
                <Link href="/compliance-notice" className="flex-shrink-0">
                  <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap border-primary/40 text-primary hover:bg-primary/10">
                    Read Full Compliance Notice <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
