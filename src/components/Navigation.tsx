"use client";

import { useEffect, useState, useCallback, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Menu, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accessPortalEntries } from "@/lib/accessPortals";

type NavItem = {
  label: string;
  path: string;
  description?: string;
};

type NavSection = {
  label: string;
  path: string;
  items: NavItem[];
};

const NAV_SECTIONS_DATA: NavSection[] = [
  {
    label: "Home",
    path: "/",
    items: [
      { label: "Overview", path: "/", description: "Platform overview and highlights" },
      { label: "Platform Highlights", path: "/#highlights", description: "What GEM Enterprise delivers" },
      { label: "Leadership", path: "/company", description: "Leadership and trust signals" },
      { label: "Client Access", path: "/client-login", description: "Access your client account" },
      { label: "Get Started", path: "/get-started", description: "Begin onboarding" },
    ],
  },
  {
    label: "Intel",
    path: "/intel",
    items: [
      { label: "Threat Intelligence", path: "/intel", description: "Global threat landscape and briefings" },
      { label: "Reports", path: "/intel#reports", description: "Published intelligence reports" },
      { label: "Monitoring", path: "/intel#monitoring", description: "Continuous threat monitoring" },
      { label: "Intel Briefs", path: "/intel#briefs", description: "Concise intelligence summaries" },
      { label: "Architecture Specs", path: "/developers", description: "Platform architecture and specs" },
    ],
  },
  {
    label: "News",
    path: "/intel/news",
    items: [
      {
        label: "GEM News",
        path: "/intel/news",
        description: "Live source-linked news and clearly labelled AI briefs",
      },
      {
        label: "News Newsletter",
        path: "/newsletter",
        description: "Subscribe to GEM security and intelligence updates",
      },
      {
        label: "Quick News Route",
        path: "/news",
        description: "Stable public shortcut to the native GEM news channel",
      },
      {
        label: "Video Briefings",
        path: "/intel/news/videos",
        description: "Watch publisher video coverage inside GEM",
      },
    ],
  },
  {
    label: "Services",
    path: "/services",
    items: [
      { label: "Enterprise Solutions", path: "/enterprise-solutions", description: "Official access to the GEM solutions experience" },
      { label: "Cybersecurity", path: "/services#cyber", description: "Enterprise threat protection and response" },
      { label: "Financial", path: "/services#financial", description: "Secure financial services and compliance" },
      { label: "Real Estate", path: "/services#real-estate", description: "Real estate security and asset protection" },
      { label: "Assessments", path: "/services#assessments", description: "Security posture assessments" },
      { label: "Consultations", path: "/services#consultations", description: "Strategic security consultations" },
      { label: "Alliance Trust Realty", path: "/atr", description: "Real estate investment platform — ATR Division" },
      { label: "Properties", path: "/atr/properties", description: "ATR property portfolio and listings" },
      { label: "Investment Platform", path: "/atr/invest", description: "Fractional, full ownership, fund, and REIT vehicles" },
    ],
  },
  {
    label: "Store",
    path: "/store",
    items: [
      { label: "All Solutions", path: "/store", description: "Browse the complete GEM Security Store" },
      { label: "24/7 Threat Monitoring", path: "/store/24-7-threat-monitoring", description: "Continuous monitoring and prioritized alerts" },
      { label: "Security Assessment", path: "/store/security-posture-assessment", description: "Review controls, vulnerabilities, and exposure" },
      { label: "Compliance Readiness", path: "/store/compliance-readiness-review", description: "Identify policy, evidence, and control gaps" },
      { label: "Cybersecurity Consultation", path: "/store/cybersecurity-consultation", description: "Book a focused advisory engagement" },
    ],
  },
  {
    label: "Community",
    path: "/community-hub",
    items: [
      { label: "Community Hub", path: "/community-hub", description: "Flagship vetted community experience" },
      { label: "Opportunities", path: "/community-hub/opportunities", description: "Deal flow, mandates, and introductions" },
      { label: "Members", path: "/community-hub/members", description: "Directory of vetted members and advisors" },
      { label: "Circles", path: "/community-hub/circles", description: "Private topical working groups" },
      { label: "Events", path: "/community-hub/events", description: "Summits, salons, and working sessions" },
      { label: "Knowledge", path: "/community-hub/knowledge", description: "Member-only research and playbooks" },
      { label: "Request Access", path: "/request-access", description: "Apply to join the GEM Community Hub" },
      { label: "Community Overview", path: "/community-hub#overview", description: "Community structure and benefits" },
    ],
  },
  {
    label: "Hub",
    path: "/hub",
    items: [
      { label: "Command Center", path: "/hub", description: "Operational command and control" },
      { label: "Documents", path: "/app/documents", description: "Platform documents and agreements" },
      { label: "Support Access", path: "/app/support", description: "Connect with enterprise support" },
      { label: "Requests", path: "/app/requests", description: "Submit service requests" },
      { label: "Client Portal", path: "/client-login", description: "Authenticated client access" },
    ],
  },
  {
    label: "Resources",
    path: "/resources",
    items: [
      { label: "Market Insights", path: "/resources#insights", description: "Intelligence and market analysis" },
      { label: "Templates", path: "/resources#templates", description: "Downloadable security templates" },
      { label: "Bots", path: "/resources#bots", description: "Automated intelligence tools" },
      { label: "GEM News", path: "/intel/news", description: "Open the built-in GEM news channel" },
      { label: "Newsletter", path: "/newsletter", description: "Subscribe to intelligence updates" },
      { label: "FAQ", path: "/resources#faq", description: "Frequently asked questions" },
    ],
  },
  {
    label: "Company",
    path: "/company",
    items: [
      { label: "About", path: "/about", description: "About GEM Enterprise" },
      { label: "Leadership & Vision", path: "/company#leadership", description: "Executive leadership and mission" },
      { label: "Executive Board", path: "/company#board", description: "Board of directors" },
      { label: "Teams", path: "/company#teams", description: "Expert teams and divisions" },
      { label: "Personnel Board", path: "/personnel", description: "GEM & ATR personnel directory with AI Overseer" },
    ],
  },
];

const navSections = NAV_SECTIONS_DATA;

function NavigationContent() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setOpenSection(null);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const toggleSection = useCallback((label: string) => {
    setOpenSection((prev) => (prev === label ? null : label));
  }, []);

  const isActive = useCallback((path: string) => {
    const base = path.split("#")[0];
    if (base === "/") return pathname === "/";
    return pathname === base || pathname.startsWith(`${base}/`);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <header className="sticky top-0 z-[10000] w-full border-b border-white/[0.07] bg-[#131a26]/95 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-5 sm:px-6 lg:h-16 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3" onClick={closeMobile}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(185,100%,45%)]/10 ring-1 ring-[hsl(185,100%,45%)]/30 transition-all group-hover:bg-[hsl(185,100%,45%)]/20 group-hover:ring-[hsl(185,100%,45%)]/60 lg:h-9 lg:w-9 lg:rounded-xl">
            <Shield className="h-7 w-7 text-[hsl(185,100%,45%)] lg:h-5 lg:w-5" strokeWidth={2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-[0.18em] text-[hsl(185,100%,45%)] lg:text-base">GEM</span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/40 lg:text-[10px]">Enterprise</span>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 lg:flex">
          {navSections.map((section) => (
            <Link
              key={section.path}
              href={section.path}
              className={cn(
                "rounded-lg px-2.5 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white",
                isActive(section.path) && "bg-cyan-400/10 text-cyan-300",
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/enterprise-solutions" className="rounded-md px-3 py-2 text-sm font-medium text-cyan-300/80 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200">
            Solutions
          </Link>
          <Link href="/contact" className="rounded-md px-3 py-2 text-sm font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-white">
            Contact
          </Link>
          <div className="group relative">
            <Button variant="ghost" size="sm" className="border border-white/10 bg-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white" aria-haspopup="menu">
              Sign in <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <div className="invisible absolute right-0 top-full z-50 w-64 translate-y-1 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="rounded-2xl border border-white/10 bg-[#101722] p-2 shadow-2xl" role="menu">
                {accessPortalEntries.map((item) => (
                  <Link key={item.id} href={item.href} role="menuitem" className="block rounded-xl px-3 py-3 hover:bg-white/5">
                    <span className="block text-sm font-semibold text-white/80">{item.shortLabel}</span>
                    <span className="mt-0.5 block text-xs text-white/40">{item.description}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Button asChild size="sm" className="bg-[hsl(185,100%,45%)] font-semibold text-[#131a26] shadow-[0_0_20px_hsl(185,100%,45%,0.35)] transition-all hover:bg-[hsl(185,100%,50%)] hover:shadow-[0_0_28px_hsl(185,100%,45%,0.5)]">
            <Link href="/get-started">Get Started</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/70 shadow-lg transition-all hover:bg-white/10 hover:text-white active:scale-95 lg:hidden"
          onClick={toggleMobileMenu}
        >
          {mobileOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="fixed inset-x-0 top-20 z-[9999] max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-white/[0.07] bg-[#0e1420] px-5 pb-28 pt-4 shadow-2xl lg:hidden">
          <nav aria-label="Mobile navigation" className="space-y-2">
            {navSections.map((section) => {
              const isOpen = openSection === section.label;
              return (
                <div key={section.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-lg font-semibold transition-all active:scale-95",
                      isActive(section.path) ? "text-cyan-300 bg-cyan-400/5" : "text-white/75 hover:bg-white/[0.02]",
                    )}
                    onClick={() => toggleSection(section.label)}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={cn("h-5 w-5 text-white/30 transition-transform duration-200", isOpen && "rotate-180 text-cyan-300")} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/[0.06] px-4 py-4">
                      <Link
                        href={section.path}
                        className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/90"
                        onClick={closeMobile}
                      >
                        All {section.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <div className="grid gap-4">
                        {section.items.map((item) => (
                          <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                              "rounded-xl px-3 py-3 transition-colors hover:bg-white/5",
                              isActive(item.path) ? "bg-cyan-400/10" : "",
                            )}
                            onClick={closeMobile}
                          >
                            <div className={cn(
                              "font-semibold",
                              isActive(item.path) ? "text-cyan-300" : "text-white/60",
                            )}>
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="mt-1 text-sm text-white/40">{item.description}</div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-5 grid gap-3 border-t border-white/[0.07] pt-5">
              <Button asChild variant="outline" className="h-14 justify-center border-cyan-400/30 bg-cyan-400/5 text-base font-semibold text-cyan-200 hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:text-cyan-100">
                <Link href="/enterprise-solutions" onClick={closeMobile}>Enterprise Solutions</Link>
              </Button>
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
                <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/35">Choose your sign-in</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {accessPortalEntries.map((item) => (
                    <Link key={item.id} href={item.href} onClick={closeMobile} className="rounded-xl px-3 py-3 transition-colors hover:bg-white/5">
                      <span className="block text-sm font-semibold text-white/75">{item.shortLabel}</span>
                      <span className="mt-0.5 block text-xs text-white/35">{item.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <Button asChild className="h-14 bg-[hsl(185,100%,45%)] text-base font-bold text-[#131a26] shadow-[0_0_25px_hsl(185,100%,45%,0.35)] hover:bg-[hsl(185,100%,50%)]">
                <Link href="/get-started" onClick={closeMobile}>Get Started</Link>
              </Button>
              <p className="px-1 pt-2 text-xs leading-relaxed text-white/30">
                Qualified client access only. KYC verification and compliance approval are required.
              </p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export const Navigation = memo(NavigationContent);
