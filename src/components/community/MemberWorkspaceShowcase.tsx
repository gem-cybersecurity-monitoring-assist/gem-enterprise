import { MessageSquare, Sparkles, Users } from "lucide-react";

const WORKSPACE_ORIGIN = "https://gem-community-operations.p6kwdvjbpp.chatgpt.site";
const workspaceLinks = [
  { path: "/community", label: "Open member workspace", icon: MessageSquare, primary: true },
  { path: "/community/ai", label: "My AI services", icon: Sparkles, primary: false },
  { path: "/community/members", label: "Member directory", icon: Users, primary: false },
];

/** Public navigation only. Private records and credentials never cross this boundary. */
export function MemberWorkspaceShowcase() {
  return (
    <section
      aria-label="GEM member workspace"
      className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Member workspace</p>
        <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
          Private access
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Your community conversations and AI services
      </h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        Ask questions, join discussions, develop ideas, and share recommendations.
        Meet members who have shared their profiles and use the AI services assigned to you.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {workspaceLinks.map(({ path, label, icon: Icon, primary }) => (
          <a
            key={path}
            href={`${WORKSPACE_ORIGIN}${path}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} (opens in a new tab)`}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
              primary
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Opens a separate workspace with ChatGPT sign-in. Access is managed separately;
        signing in to GEM Enterprise does not automatically grant membership or specialist AI access.
      </p>
    </section>
  );
}
