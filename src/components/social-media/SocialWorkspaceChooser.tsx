import Link from "next/link";
import { socialAccountsHref } from "@/lib/social-media/channel-routes";
import type { SocialMediaProviderId } from "@/lib/social-media/providers";

/** Options must come from the account's existing server-side membership resolution. */
export function SocialWorkspaceChooser({
  workspaces,
  selectedId,
  destination,
}: {
  workspaces: ReadonlyArray<{ id: string; name: string }>;
  selectedId: string | null;
  destination?: SocialMediaProviderId;
}) {
  if (workspaces.length === 0) return null;
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-card/75 p-4 sm:p-5">
      <h2 className="font-semibold text-white">Choose your social workspace</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Each workspace has its own connected accounts. Only workspaces your account can access appear here.
      </p>
      <nav aria-label="Social workspaces" className="mt-3 flex flex-wrap gap-2">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={socialAccountsHref(destination, workspace.id)}
            aria-current={workspace.id === selectedId ? "page" : undefined}
            className="inline-flex min-h-11 max-w-full items-center break-words rounded-xl border border-white/15 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10 aria-[current=page]:border-cyan-300/40 aria-[current=page]:bg-cyan-400/15"
          >
            {workspace.name}
          </Link>
        ))}
      </nav>
    </section>
  );
}
