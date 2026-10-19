"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  MessageSquare,
  Calendar,
  FileText,
  ArrowRight,
  MapPin,
  Mail,
  CheckCircle,
  Globe,
  Bell,
  BookOpen,
  TrendingUp,
  Shield,
  Award,
  ChevronRight,
  ThumbsUp,
  Eye,
  Hash,
  Search,
  Sparkles,
  Network,
  Fingerprint,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCUSSIONS = [
  {
    category: "Market Intelligence",
    title: "Q2 2026 Commercial Real Estate Outlook — Thread",
    author: "M. Harrington",
    role: "CISO · Meridian Capital",
    time: "2h ago",
    replies: 24,
    views: 312,
    pinned: true,
    tag: "Investing",
    color: "amber",
  },
  {
    category: "Cybersecurity",
    title: "New SEC disclosure rules impact on enterprise reporting workflows",
    author: "David Chen",
    role: "MD Portfolio Risk · Apex Financial",
    time: "5h ago",
    replies: 18,
    views: 204,
    pinned: false,
    tag: "Compliance",
    color: "cyan",
  },
  {
    category: "Real Estate Fraud",
    title: "Title deed monitoring — best practices for large portfolios?",
    author: "Priya Nambiar",
    role: "VP Enterprise Risk · Northstar",
    time: "1d ago",
    replies: 11,
    views: 178,
    pinned: false,
    tag: "Real Estate",
    color: "emerald",
  },
  {
    category: "Platform Updates",
    title: "GEM Dashboard v3.2 — new alerting rules & KYC improvements",
    author: "GEM Team",
    role: "Official",
    time: "2d ago",
    replies: 9,
    views: 445,
    pinned: false,
    tag: "Platform",
    color: "purple",
  },
  {
    category: "Regulatory",
    title: "FINRA exam prep resources — member compilation thread",
    author: "R. Okonkwo",
    role: "Chief Compliance · Vanguard Infrastructure",
    time: "3d ago",
    replies: 32,
    views: 519,
    pinned: false,
    tag: "Compliance",
    color: "cyan",
  },
];

const EVENTS = [
  {
    date: "APR 8",
    title: "Enterprise Threat Landscape Webinar — Q2 2026",
    type: "Virtual",
    location: null,
  },
  {
    date: "APR 22",
    title: "Financial Crime & Cyber Risk Summit",
    type: "In-Person",
    location: "New York, NY",
  },
  {
    date: "MAY 14",
    title: "Real Estate Fraud Prevention Workshop",
    type: "Virtual",
    location: null,
  },
  {
    date: "JUN 3",
    title: "GEM Annual Enterprise Security Summit",
    type: "In-Person",
    location: "Washington, D.C.",
  },
];

const MEMBERS = [
  { name: "M. Harrington", role: "CISO", company: "Meridian Capital", online: true },
  { name: "David Chen", role: "Managing Director", company: "Apex Financial", online: true },
  { name: "Priya Nambiar", role: "VP Enterprise Risk", company: "Northstar Realty", online: false },
  { name: "R. Okonkwo", role: "Chief Compliance", company: "Vanguard Infra", online: true },
  { name: "L. Barnes", role: "CTO", company: "Crestview Legal", online: false },
  { name: "S. Patel", role: "CFO", company: "Sovereign Risk", online: true },
];

const RESOURCES = [
  { icon: Shield, title: "Threat Intelligence Digest", tag: "Cybersecurity", date: "Mar 2026" },
  { icon: TrendingUp, title: "Q1 2026 Real Estate Market Report", tag: "Real Estate", date: "Mar 2026" },
  { icon: FileText, title: "SEC Disclosure Rules — Summary Guide", tag: "Compliance", date: "Feb 2026" },
  { icon: BookOpen, title: "Enterprise Risk Framework v4.1", tag: "Strategy", date: "Feb 2026" },
  { icon: Globe, title: "Global Property Fraud Trends 2026", tag: "Real Estate", date: "Jan 2026" },
  { icon: Award, title: "SOC 2 Audit Preparation Checklist", tag: "Compliance", date: "Jan 2026" },
];

const BENEFITS = [
  "Priority access to GEM intelligence briefings and threat advisories",
  "Exclusive quarterly executive roundtables with GEM analysts",
  "Early access to new platform features and research publications",
  "Dedicated account manager and named incident response liaison",
  "Member-only secure communication channel for peer collaboration",
  "Discounted rates on advisory engagements and training programs",
  "Invitations to GEM's annual Enterprise Security Summit",
];

const TAG_COLORS: Record<string, string> = {
  Investing: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  Compliance: "bg-cyan-400/10 text-cyan-400 border-cyan-400/30",
  "Real Estate": "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  Platform: "bg-purple-400/10 text-purple-400 border-purple-400/30",
  Strategy: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  Cybersecurity: "bg-cyan-400/10 text-cyan-400 border-cyan-400/30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"discussions" | "events" | "members" | "resources">(
    "discussions"
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 cyber-grid overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background pointer-events-none" />
        <div className="relative z-10 container mx-auto px-6 text-center max-w-4xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-primary/10 text-primary glow-cyan">
              <Users className="h-10 w-10" />
            </div>
          </div>
          <Badge className="mb-5 bg-primary/10 text-primary border-primary/30 font-mono text-xs tracking-widest uppercase px-4 py-1.5">
            Enterprise Network
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-5">
            The GEM Enterprise{" "}
            <span className="text-gradient-primary">Community</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A private network of enterprise security leaders, financial executives, and real estate
            professionals — connected through GEM&apos;s intelligence platform and shared
            commitment to security excellence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan font-semibold"
              asChild
            >
              <Link href="/get-started">
                Apply for Membership <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-border/60" asChild>
              <Link href="/client-login">Sign In to Hub</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-muted-foreground gap-2"
              asChild
            >
              <Link href="/community-hub">
                Explore Community Hub <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ══ COMMUNITY HUB PREVIEW ═════════════════════════════════════════════ */}
      <section className="border-y border-border bg-card/20 py-20">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
                  Community Hub — Live
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-balance">
                A private operating room for{" "}
                <span className="text-gradient-primary">serious operators</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed text-pretty">
                The GEM Community Hub is where vetted members exchange opportunities, form circles,
                and get work done away from public noise. Apply to join, or explore the public-facing
                preview below.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan font-semibold gap-2" asChild>
                <Link href="/community-hub">
                  Open Community Hub <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="border-border/60 gap-2" asChild>
                <Link href="/request-access">
                  Request Access
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-panel bento-card border-border/50 hover:border-primary/40 transition-colors">
              <CardContent className="p-6">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Opportunities</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Live mandates, deal flow, and introductions surfaced only to members whose profile
                  matches the remit.
                </p>
                <Link
                  href="/community-hub/opportunities"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Browse Opportunities <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="glass-panel bento-card border-border/50 hover:border-primary/40 transition-colors">
              <CardContent className="p-6">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Circles</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Private working groups around cybersecurity, capital, real estate, and
                  jurisdiction-specific practice.
                </p>
                <Link
                  href="/community-hub/circles"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  See Circles <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card className="glass-panel bento-card border-border/50 hover:border-primary/40 transition-colors">
              <CardContent className="p-6">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                  <Fingerprint className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Verified Members</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Every member is individually reviewed. Directory access and introductions unlock
                  after approval.
                </p>
                <Link
                  href="/community-hub/members"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Meet the Network <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              Not a member yet?{" "}
              <Link href="/request-access" className="text-primary hover:underline font-medium">
                Request access
              </Link>{" "}
              — we respond to every application.
            </span>
          </div>
        </div>
      </section>

      {/* ══ COMMUNITY TABS ════════════════════════════════════════════════════ */}
      <section className="py-16 container mx-auto px-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-8 border-b border-border overflow-x-auto">
          {(
            [
              { id: "discussions", label: "Discussions", icon: MessageSquare },
              { id: "events", label: "Events", icon: Calendar },
              { id: "members", label: "Members", icon: Users },
              { id: "resources", label: "Resources", icon: FileText },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Discussions ── */}
        {activeTab === "discussions" && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search discussions..." className="pl-9 bg-card/50 border-border/60" />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm" asChild>
                <Link href="/client-login">New Discussion</Link>
              </Button>
            </div>

            {DISCUSSIONS.map((d, i) => (
              <Card key={i} className="glass-panel bento-card border-border/50 hover:border-border/80 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 mt-0.5">
                      {d.author.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {d.pinned && (
                          <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 text-[10px] font-mono">
                            Pinned
                          </Badge>
                        )}
                        <Badge className={`text-[10px] border ${TAG_COLORS[d.tag] ?? "bg-muted text-muted-foreground"}`}>
                          {d.tag}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{d.category}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1 leading-snug">
                        {d.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{d.author}</span>
                        <span className="opacity-40">·</span>
                        <span>{d.role}</span>
                        <span className="opacity-40">·</span>
                        <span>{d.time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {d.replies}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {d.views}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="pt-4 text-center">
              <Button variant="outline" className="border-border/60 text-muted-foreground gap-2" asChild>
                <Link href="/client-login">
                  Sign in to view all discussions <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* ── Events ── */}
        {activeTab === "events" && (
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
            {EVENTS.map((event, i) => (
              <Card key={i} className="glass-panel bento-card border-border/50">
                <CardContent className="pt-5 pb-5 flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-primary uppercase">{event.date.slice(0, 3)}</span>
                    <span className="text-xl font-bold text-primary">{event.date.slice(4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        className={`text-xs ${
                          event.type === "Virtual"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        }`}
                      >
                        {event.type}
                      </Badge>
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {event.location}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug mb-3">
                      {event.title}
                    </h3>
                    <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs">
                      Register Interest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Members ── */}
        {activeTab === "members" && (
          <div className="max-w-4xl">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {MEMBERS.map((m, i) => (
                <Card key={i} className="glass-panel border-border/50">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {m.name.charAt(0)}
                      </div>
                      {m.online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.role}</p>
                      <p className="text-xs text-primary font-mono truncate">{m.company}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                +480 members — full directory available to members
              </p>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" asChild>
                <Link href="/get-started">
                  Join the Community <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* ── Resources ── */}
        {activeTab === "resources" && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-4xl">
            {RESOURCES.map((r, i) => {
              const Icon = r.icon;
              return (
                <Card key={i} className="glass-panel bento-card border-border/50 hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="pt-5 pb-5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug mb-1">{r.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] border ${TAG_COLORS[r.tag] ?? "bg-muted text-muted-foreground"}`}>
                          {r.tag}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">{r.date}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <div className="col-span-full text-center pt-4">
              <Button variant="outline" className="border-border/60 text-muted-foreground" asChild>
                <Link href="/resources">View Full Resource Library</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ══ MEMBERSHIP ════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-6 max-w-5xl grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Membership <span className="text-gradient-primary">Benefits</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8">
              GEM Community membership is extended by invitation or application to qualified
              enterprise clients. Members gain exclusive access to intelligence, events, and a
              curated professional network.
            </p>
            <ul className="space-y-3">
              {BENEFITS.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="glass-panel border-border/50 sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Apply for Membership</CardTitle>
              <p className="text-muted-foreground text-sm">
                Membership is subject to review and approval. Applications assessed within 5
                business days.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="text-foreground font-medium">Eligibility:</span> Enterprise
                  organizations with 100+ employees or $50M+ in annual revenue.
                </p>
                <p>
                  <span className="text-foreground font-medium">Process:</span> Submit
                  application, complete KYC verification, attend onboarding briefing.
                </p>
                <p>
                  <span className="text-foreground font-medium">Timeline:</span> Approved members
                  gain platform access within 48 hours of verification.
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan font-semibold"
              >
                <Link href="/get-started">
                  Apply for Membership <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already a member?{" "}
                <Link href="/client-login" className="text-primary hover:underline">
                  Sign in to the Hub
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ══ NEWSLETTERS ═══════════════════════════════════════════════════════ */}
      <section id="newsletters" className="py-24 container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Intelligence <span className="text-gradient-primary">Newsletters</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Stay informed with GEM&apos;s curated publications — delivered directly to your inbox.
          </p>
        </div>

        {/* Live feed banner */}
        <Card className="glass-panel border-primary/30 max-w-5xl mx-auto mb-8 overflow-hidden">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                    Live
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/30 text-xs font-mono">
                    GEM INTEL
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-1">
                  GEM Intel News Feed
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Continuously updated headlines across crypto, cyber, markets,
                  geopolitics, policy, and alternatives — the same stream that
                  feeds our newsletters.
                </p>
              </div>
            </div>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan font-semibold gap-2 shrink-0"
              asChild
            >
              <Link href="/intel/news">
                Open Live Feed <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              title: "The GEM Threat Wire",
              frequency: "Weekly",
              description:
                "A concise weekly digest of the top cybersecurity developments, emerging threat actors, and actionable defensive recommendations for enterprise security teams.",
              tag: "Cybersecurity",
            },
            {
              title: "Financial Security Monitor",
              frequency: "Monthly",
              description:
                "Monthly analysis of financial crime trends, regulatory developments, and asset protection strategies — written for CFOs, compliance officers, and institutional investors.",
              tag: "Financial",
            },
            {
              title: "Real Estate Intelligence Brief",
              frequency: "Monthly",
              description:
                "Property fraud trends, title crime developments, and market-level security intelligence for real estate executives and portfolio managers.",
              tag: "Real Estate",
            },
          ].map((nl) => (
            <Card key={nl.title} className="glass-panel bento-card border-border/50 flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                    {nl.tag}
                  </Badge>
                  <Badge className="bg-muted text-muted-foreground border-border text-xs">
                    {nl.frequency}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold">{nl.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                  {nl.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/40 text-primary hover:bg-primary/10 w-full"
                >
                  <Mail className="mr-2 h-3.5 w-3.5" /> Subscribe
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-card/40 border-t border-border">
        <div className="container mx-auto px-6 text-center max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Join the GEM <span className="text-gradient-primary">Community</span>
          </h2>
          <p className="text-muted-foreground mb-10 text-lg">
            Connect with enterprise security leaders, access exclusive intelligence, and strengthen
            your organization&apos;s security posture with the GEM network behind you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan font-semibold px-8"
            >
              <Link href="/get-started">
                Apply for Membership <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10 font-semibold px-8"
            >
              <Link href="/client-login">Client Login</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
