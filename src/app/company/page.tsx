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
    name: "Alexander Mercer",
    title: "Chief Executive Officer",
    bio: "A veteran of enterprise risk and institutional finance with over two decades navigating global markets, regulatory environments, and high-stakes security operations. Mercer founded GEM Enterprise with a mandate to deliver intelligence-grade security at institutional scale, drawing on prior leadership roles at a major sovereign wealth fund and a Big Four advisory practice.",
    initials: "AM",
  },
  {
    name: "Dr. Samira Okonkwo",
    title: "Chief Security Officer",
    bio: "Former lead of a national-level cyber threat intelligence unit with deep expertise in advanced persistent threats, critical infrastructure protection, and zero-trust architecture. Dr. Okonkwo holds a doctorate in information systems security and has testified before regulatory bodies on enterprise cybersecurity standards.",
    initials: "SO",
  },
  {
    name: "Marcus Thornton",
    title: "Chief Financial Officer",
    bio: "A seasoned financial executive with institutional investment banking, fund administration, and multi-jurisdictional regulatory compliance experience spanning over 18 years. Thornton leads GEM's financial operations and oversees client asset protection frameworks with prior tenures at a Tier 1 investment bank and a leading asset management firm.",
    initials: "MT",
  },
  {
    name: "Catherine Voss, Esq.",
    title: "General Counsel & Chief Compliance Officer",
    bio: "An accomplished attorney specializing in data privacy law, regulatory enforcement, and corporate governance across financial services and technology sectors. Voss provides legal oversight for all client engagements, compliance programs, and GEM's operational policies across multiple jurisdictions, including prior service as Deputy General Counsel at a global financial institution.",
    initials: "CV",
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
    name: "Cybersecurity Division",
    headcount: "40+ Specialists",
    description:
      "Our core security team operates the GEM Security Operations Center and delivers threat intelligence, incident response, penetration testing, and security architecture services to enterprise clients globally. This division maintains 24/7 operational coverage across all client environments.",
    capabilities: ["SOC Operations", "Threat Intelligence", "Red Team", "Digital Forensics"],
  },
  {
    icon: Shield,
    name: "Intelligence Division",
    headcount: "12+ Analysts",
    description:
      "A specialized unit focused on open-source intelligence, dark web monitoring, geopolitical risk analysis, and adversary profiling. The Intelligence Division informs proactive defense decisions across all client engagements and contributes to GEM's proprietary threat intelligence feeds.",
    capabilities: ["OSINT Operations", "Dark Web Monitoring", "Adversary Profiling", "Geopolitical Risk"],
  },
  {
    icon: TrendingUp,
    name: "Financial Security Division",
    headcount: "15+ Analysts",
    description:
      "Specialists in financial institution security, fraud prevention, AML compliance, and regulatory risk. This division protects client financial operations, supports risk quantification and regulatory reporting, and coordinates with forensic accounting partners on complex investigations.",
    capabilities: ["Transaction Security", "Fraud Prevention", "AML Compliance", "Financial Forensics"],
  },
  {
    icon: Home,
    name: "Real Estate Division",
    headcount: "10+ Advisors",
    description:
      "Security advisors focused on property and transaction protection. This team secures real estate investment platforms, property management systems, and closing processes. The division maintains integrations with major county recorder databases for real-time deed monitoring.",
    capabilities: ["Property Security", "Title Monitoring", "Closing Protection", "Portfolio Management"],
  },
  {
    icon: Settings,
    name: "Operations Division",
    headcount: "20+ Professionals",
    description:
      "The operational backbone of GEM Enterprise. This team manages client onboarding, platform infrastructure, internal security, vendor relationships, and organizational resilience programs. Operations ensures consistent service delivery and SLA adherence across all engagements.",
    capabilities: ["Client Onboarding", "Platform Operations", "Vendor Management", "Business Continuity"],
  },
  {
    icon: Gavel,
    name: "Compliance Division",
    headcount: "8+ Attorneys & Compliance Officers",
    description:
      "In-house legal and compliance professionals ensuring GEM operates within applicable regulatory frameworks and that client engagements adhere to the highest standards of legal and ethical practice. This division manages KYC/AML screening, regulatory filings, and client compliance advisory.",
    capabilities: ["Regulatory Compliance", "KYC/AML Oversight", "Data Privacy", "Audit Support"],
  },
];

const partners = [
  {
    name: "National Cybersecurity Alliance",
    type: "Industry Association",
    description: "Strategic membership providing access to coordinated threat intelligence sharing, policy advocacy, and best-practice frameworks for enterprise security programs.",
  },
  {
    name: "Financial Services Information Sharing and Analysis Center (FS-ISAC)",
    type: "Intelligence Consortium",
    description: "Participation in the global financial sector's primary threat intelligence sharing network, enabling real-time correlation of financial sector-specific threats.",
  },
  {
    name: "American Land Title Association (ALTA)",
    type: "Industry Body",
    description: "Affiliation with the national association for title insurance and settlement services, supporting GEM's real estate security standards and title fraud prevention programs.",
  },
  {
    name: "ISACA — Information Systems Audit and Control Association",
    type: "Standards Body",
    description: "Organizational membership supporting GEM's commitment to internationally recognized IT governance, audit, and security standards across all client engagements.",
  },
  {
    name: "Association of Certified Fraud Examiners (ACFE)",
    type: "Professional Association",
    description: "Partnership supporting GEM's financial forensics capabilities and professional development standards for fraud examination and financial crime investigation.",
  },
  {
    name: "Cloud Security Alliance (CSA)",
    type: "Research Organization",
    description: "Contributing membership to the global standards body defining cloud security best practices, informing GEM's cloud security assessment frameworks and client advisory services.",
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
            GEM Enterprise exists to close the gap between enterprise ambition and operational security reality.
            We deliver intelligence-grade protection for organizations that cannot afford to be wrong.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {[
              { label: "Leadership & Vision", href: "#leadership" },
              { label: "Executive Board", href: "#board" },
              { label: "Teams", href: "#teams" },
              { label: "Partners & Trustees", href: "#partners" },
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
              <h2 className="text-3xl font-bold">Executive Board</h2>
              <p className="text-muted-foreground text-sm mt-0.5">The leadership team guiding GEM Enterprise</p>
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
              <h2 className="text-3xl font-bold">Partners & Trustees</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Strategic alliances and institutional relationships that strengthen our capabilities</p>
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
              Confidential trustee and institutional partner identities are disclosed to clients under NDA
              during the onboarding process. GEM Enterprise does not publicly disclose specific financial
              custodian or institutional relationships without written authorization.
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
