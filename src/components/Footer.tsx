import Link from "next/link";
import { Shield, ExternalLink } from "lucide-react";
import { getFooterRoutes, navigationMenu } from "@/lib/siteRoutes";

const footerRoutes = getFooterRoutes();

const platformGroups = ["intel", "services", "community", "hub"] as const;
const platformSections = navigationMenu.filter((section) =>
  (platformGroups as readonly string[]).includes(section.group),
);

const companyLinks = [
  { label: "About", path: "/about" },
  { label: "Leadership", path: "/company#leadership" },
  { label: "Teams", path: "/company#teams" },
  { label: "Compliance Notice", path: "/compliance-notice" },
];

const legalLinks = [
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms of Service", path: "/terms" },
  { label: "Compliance Notice", path: "/compliance-notice" },
  { label: "Cookie Policy", path: "/cookie-policy" },
  { label: "Trust Center", path: "/trust-center" },
];

const clientAccessLinks = [
  { label: "Client Login", path: "/client-login" },
  { label: "Eligibility Status", path: "/eligibility/status" },
  { label: "Get Started", path: "/get-started" },
  { label: "Contact", path: "/contact" },
];

void footerRoutes;

function FooterColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
      {children}
    </h3>
  );
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const inner = (
    <span className="inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-[hsl(185,100%,45%)]">
      {children}
      {external && <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />}
    </span>
  );

  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href}>{inner}</Link>
    </li>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#0a1018]" aria-label="Site footer">
      <div className="mx-auto max-w-screen-xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(185,100%,45%)]/10 ring-1 ring-[hsl(185,100%,45%)]/25 transition-all group-hover:ring-[hsl(185,100%,45%)]/50">
                <Shield className="h-5 w-5 text-[hsl(185,100%,45%)]" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold tracking-widest text-[hsl(185,100%,45%)]">GEM</span>
                <span className="text-[10px] font-semibold tracking-[0.25em] text-white/35 uppercase">
                  Enterprise
                </span>
              </div>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-white/45">
              Cybersecurity, financial security, and real estate protection services for individuals,
              organizations, and eligible institutional clients.
            </p>
          </div>

          <div className="max-w-xs rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[hsl(280,40%,60%)]">
              Service Eligibility
            </p>
            <p className="text-xs leading-relaxed text-white/35">
              Public cybersecurity products and general information are broadly available. Certain
              institutional, financial, or jurisdiction-restricted services require eligibility and
              compliance review before activation.
            </p>
          </div>
        </div>

        <div className="mb-12 h-px bg-white/[0.06]" />

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          <div>
            <FooterColumnHeading>Platform</FooterColumnHeading>
            <ul className="space-y-2.5">
              <FooterLink href="/enterprise-solutions">Enterprise Solutions</FooterLink>
              <FooterLink href="/intel/news">GEM News</FooterLink>
              <FooterLink href="/newsletter">News Newsletter</FooterLink>
              {platformSections.map((section) => (
                <FooterLink key={section.group} href={section.path}>
                  {section.label}
                </FooterLink>
              ))}
            </ul>
          </div>

          <div>
            <FooterColumnHeading>Company</FooterColumnHeading>
            <ul className="space-y-2.5">
              {companyLinks.map(({ label, path }) => (
                <FooterLink key={path} href={path}>
                  {label}
                </FooterLink>
              ))}
            </ul>
          </div>

          <div>
            <FooterColumnHeading>Legal</FooterColumnHeading>
            <ul className="space-y-2.5">
              {legalLinks.map(({ label, path }) => (
                <FooterLink key={path} href={path}>
                  {label}
                </FooterLink>
              ))}
            </ul>
          </div>

          <div>
            <FooterColumnHeading>Client Access</FooterColumnHeading>
            <ul className="space-y-2.5">
              {clientAccessLinks.map(({ label, path }) => (
                <FooterLink key={path} href={path}>
                  {label}
                </FooterLink>
              ))}
            </ul>

            <div className="mt-6">
              <Link
                href="/request-access"
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(185,100%,45%)] px-4 py-2 text-sm font-semibold text-[#131a26] shadow-[0_0_18px_hsl(185,100%,45%,0.3)] transition-all hover:bg-[hsl(185,100%,50%)]"
              >
                Apply for Access
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
