import Link from "next/link";
import { ArrowUpRight, ClipboardList, KeyRound, UserRoundCheck, LayoutDashboard, Headphones, UserPlus, ShieldCheck } from "lucide-react";

/**
 * Existing GEM client lifecycle navigation. Route presence does not establish
 * a successful account provisioning transaction or production acceptance.
 */
export const clientActivationStages = [
  {
    key: "apply",
    title: "Enterprise application",
    description: "A prospective client submits an enterprise qualification request into the dedicated intake route.",
    href: "/enterprise/apply",
    icon: ClipboardList,
    status: "Entry route implemented",
  },
  {
    key: "review",
    title: "Human qualification",
    description: "Authorized staff review the intake record and determine the approved next step.",
    href: "/app/admin/intake",
    icon: UserRoundCheck,
    status: "Reviewer acceptance pending",
  },
  {
    key: "invite",
    title: "Owner-issued invitation",
    description: "The Platform Owner issues a protected, single-use invitation. Public applicants cannot grant themselves access.",
    href: "/app/admin/workspace-access",
    icon: UserPlus,
    status: "Owner transaction test pending",
  },
  {
    key: "activate",
    title: "Client account activation",
    description: "The invited client opens their private link and chooses credentials; a standalone visit cannot create an account.",
    href: "/workspace-invitation",
    icon: KeyRound,
    status: "Invitation acceptance test pending",
  },
  {
    key: "workspace",
    title: "Secure workspace",
    description: "An approved client signs in and sees only the organizations and projects granted to their account.",
    href: "/client-login?next=%2Fapp%2Fworkspace",
    icon: LayoutDashboard,
    status: "Client/tenant acceptance pending",
  },
  {
    key: "delivery",
    title: "Services and support",
    description: "The authorized client accesses workspace service requests, documents and support within granted permissions.",
    href: "/app/requests",
    icon: Headphones,
    status: "Service lifecycle test pending",
  },
] as const;

export function SaaSClientActivationJourney() {
  return (
    <section aria-labelledby="client-activation-journey" className="space-y-5 rounded-[30px] border border-white/10 bg-slate-900/75 p-6 sm:p-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Client lifecycle
          </p>
          <h2 id="client-activation-journey" className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            Application to operating workspace
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Use the existing GEM routes for a new client. Each stage requires a real user or service test
            before it can be certified as working in production. Built pages do not automatically create accounts.
          </p>
        </div>
        <Link href="/app/command-center/saas/readiness" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10">
          Open readiness checks <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {clientActivationStages.map(({ key, title, description, href, icon: Icon, status }, index) => (
          <li key={key} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">
                Step {index + 1}
              </span>
              <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-400">{description}</p>
            <p className="mt-3 text-xs font-medium text-amber-200">{status}</p>
            <Link href={href} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-white">
              Open existing route <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-5 text-slate-400">
        Owner invitation acceptance, protected login, tenant authorization, durable intake persistence,
        and service completion require separately recorded acceptance evidence. No publishing, billing,
        or provider activation is initiated from this panel.
      </p>
    </section>
  );
}
