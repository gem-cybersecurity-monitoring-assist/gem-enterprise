import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, PackageCheck, ShieldCheck, Truck, Warehouse } from "lucide-react";

export const metadata: Metadata = {
  title: "GlobalGateway Logistics | GEM Enterprise Business Network",
  description: "Explore the GlobalGateway logistics business-line pilot, including warehouse forwarding, USPS-assisted shipping quotations, and controlled international fulfillment.",
};

const configuredPortalUrl = process.env.NEXT_PUBLIC_GLOBALGATEWAY_URL?.trim() ?? "";
// Do not link visitors to a protected preview, unfinished checkout, or unapproved carrier integration.
const portalReady =
  process.env.NEXT_PUBLIC_GLOBALGATEWAY_PUBLIC_READY === "true" &&
  /^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[^\s]*)?$/i.test(configuredPortalUrl);

const capabilities = [
  { title: "Warehouse forwarding", description: "Register expected purchases and gifts, then request receipt, hold, inspection, consolidation, or onward delivery.", icon: Warehouse },
  { title: "Carrier-aware shipping", description: "Use actual carrier quotations only when the related USPS or fulfillment provider access has been authorized.", icon: Truck },
  { title: "International fulfillment", description: "Prepare destination details and customs information for review before an authorized carrier shipment is purchased.", icon: Globe2 },
  { title: "Transparent status", description: "Keep GlobalGateway order references distinct from carrier tracking and require confirmation before marking orders shipped.", icon: PackageCheck },
];

export default function GlobalGatewayBusinessLinePage() {
  return (
    <main className="min-h-screen bg-[#07101c] text-white">
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-24 sm:pt-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
          <ShieldCheck className="h-4 w-4" /> GEM Enterprise business network
        </div>
        <h1 className="mt-8 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
          GlobalGateway <span className="text-amber-300">Logistics</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          A separate logistics and fulfillment project supporting domestic shipping requests, managed U.S. warehouse forwarding, gift delivery, and international shipment coordination.
          GlobalGateway maintains its own customer workflow and operational controls rather than reusing the cybersecurity portal's access credentials.
        </p>
        <div className="mt-9 flex flex-wrap gap-4">
          {portalReady ? (
            <a href={configuredPortalUrl} rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-3 font-semibold text-[#07101c] hover:bg-amber-200">
              Open GlobalGateway <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-sm font-medium text-amber-200">
              Integration in validation — public launch not enabled
            </span>
          )}
          <Link href="/services" className="inline-flex items-center rounded-lg border border-white/20 px-5 py-3 font-semibold text-slate-100 hover:bg-white/10">
            GEM Enterprise services
          </Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-20 sm:grid-cols-2">
        {capabilities.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <Icon className="mb-5 h-8 w-8 text-amber-300" aria-hidden="true" />
              <h2 className="text-xl font-bold">{item.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{item.description}</p>
            </article>
          );
        })}
      </section>
      <section className="border-t border-white/10 bg-white/[0.025] px-6 py-12">
        <p className="mx-auto max-w-6xl text-sm leading-7 text-slate-400">
          Service descriptions do not imply a USPS endorsement or carrier partnership. Warehouse API actions, postage purchasing, customs processing,
          and production payment workflows require separate provider approvals, validated configuration, and confirmed operational readiness.
        </p>
      </section>
    </main>
  );
}
