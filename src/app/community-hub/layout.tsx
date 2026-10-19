import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { HubShell } from "@/components/hub/HubShell";

export const metadata: Metadata = {
  title: {
    default: "Community Preview",
    template: "%s | GEM Community Preview",
  },
  description:
    "Preview of planned GEM Enterprise community capabilities. Sample profiles, organizations, events, statistics, and opportunities are demonstration data.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CommunityHubLayout({ children }: { children: ReactNode }) {
  return (
    <HubShell>
      <aside
        role="status"
        aria-label="Demonstration data notice"
        className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100"
      >
        <div className="mx-auto flex max-w-screen-xl items-start gap-3 text-sm leading-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <p>
            <strong>Controlled preview:</strong> profiles, organizations, member counts,
            events, statistics, circles, and opportunities shown in this Community Hub are
            fictional sample data for interface testing. They are not live members, verified
            firms, active investments, or offers to transact.
          </p>
        </div>
      </aside>
      {children}
    </HubShell>
  );
}
