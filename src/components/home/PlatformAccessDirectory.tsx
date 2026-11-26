import Link from "next/link";
import {
  ArrowRight,
  Building2,
  KeyRound,
  ShieldCheck,
  Users,
  UserRoundCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { accessPortalEntries, type AccessPortalId } from "@/lib/accessPortals";
import { cn } from "@/lib/utils";

const icons = {
  login: KeyRound,
  client: Building2,
  team: Users,
  admin: UserRoundCog,
  super_admin: ShieldCheck,
} as const;

const tones = {
  cyan: "border-cyan-400/25 bg-cyan-400/[.06] text-cyan-300 hover:border-cyan-300/45",
  emerald: "border-emerald-400/25 bg-emerald-400/[.06] text-emerald-300 hover:border-emerald-300/45",
  amber: "border-amber-400/25 bg-amber-400/[.06] text-amber-300 hover:border-amber-300/45",
  violet: "border-violet-400/25 bg-violet-400/[.06] text-violet-300 hover:border-violet-300/45",
} as const;

export function PlatformAccessDirectory({
  exclude,
  compact = false,
  headingLevel = 2,
}: {
  exclude?: AccessPortalId;
  compact?: boolean;
  headingLevel?: 1 | 2;
}) {
  if (!exclude) {
    return (
      <section id="platform-access" aria-label="Account access" className="container mx-auto flex flex-wrap gap-6 px-6 py-10">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/login" className="font-semibold text-cyan-300">Sign in</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/request-access" className="font-semibold text-cyan-300">Sign up</a>
      </section>
    );
  }
  const portals = accessPortalEntries.filter((portal) => portal.id !== exclude);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const CardHeading = headingLevel === 1 ? "h2" : "h3";

  return (
    <section
      id="platform-access"
      aria-labelledby="platform-access-heading"
      className={cn(
        "scroll-mt-24 border-y border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.08),transparent_38%),rgba(255,255,255,.015)]",
        compact ? "px-4 py-10" : "py-20",
      )}
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            GEM PLATFORM ACCESS
          </Badge>
          <Heading id="platform-access-heading" className="mt-4 text-3xl font-black text-white md:text-4xl">
            One platform. The correct doorway for every role.
          </Heading>
          <p className="mt-4 max-w-2xl leading-7 text-slate-400">
            Each entrance uses the same server-authoritative identity and Workspace OS. The page you choose never grants a role; your verified account and active workspace membership decide what opens.
          </p>
        </div>

        <div className={cn("mt-8 grid gap-4", portals.length > 4 ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4")}>
          {portals.map((portal) => {
            const Icon = icons[portal.id];
            return (
              <Link
                key={portal.id}
                href={portal.href}
                className={cn(
                  "group flex min-h-64 flex-col rounded-2xl border p-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  tones[portal.accent],
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <CardHeading className="mt-5 text-lg font-bold text-white">{portal.label}</CardHeading>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[.13em] opacity-80">
                  {portal.destination}
                </p>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{portal.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-current">
                  Open access route
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Protected destinations remain fail closed. A client cannot enter administration, and an administrator does not silently impersonate a client workspace.
        </p>
      </div>
    </section>
  );
}
