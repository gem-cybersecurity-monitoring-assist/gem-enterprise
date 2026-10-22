/**
 * WorkspaceOperatingPicture (WS-C)
 *
 * Answers the four client questions from real workspace data:
 * 1) Where am I? 2) What is GEM doing for me? 3) What do I need to do now?
 * 4) What happens next?
 *
 * All numbers are passed in as props computed server-side from the database.
 * Nothing is invented: empty states say "No X recorded yet", and when the
 * session cannot observe database state the panels say so explicitly.
 */
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, FolderKanban, MapPin, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface OperatingActionItem {
  id: string;
  kind: "request" | "approval";
  title: string;
  detail: string;
  /** Optional: action items without a dedicated surface render as plain records. */
  href?: string;
}

export interface OperatingSignals {
  /** False when the session cannot observe direct database state. */
  available: boolean;
  activeProjects: number;
  openRequests: number;
  pendingApprovals: number;
  actionItems: OperatingActionItem[];
  nextEvent: {
    kind: "milestone" | "meeting";
    title: string;
    dateLabel: string | null;
    href: string;
  } | null;
}

interface WorkspaceOperatingPictureProps {
  organizationName: string;
  workspaceName: string;
  roleName: string;
  signals: OperatingSignals;
}

const unavailableCopy =
  "Workspace signals are not visible through this session. Connect through the primary session for live counts.";

export function WorkspaceOperatingPicture({
  organizationName,
  workspaceName,
  roleName,
  signals,
}: WorkspaceOperatingPictureProps) {
  return (
    <section aria-labelledby="operating-picture-heading" className="rounded-2xl border border-white/10 bg-card p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Operating picture</p>
        <h2 id="operating-picture-heading" className="mt-1 text-lg font-bold text-white sm:text-xl">
          Where things stand
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <MapPin className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Where am I?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold text-white">{workspaceName}</p>
            <p className="text-xs text-slate-400">{organizationName}</p>
            <p className="pt-1 text-xs text-slate-500">
              Assigned role: <span className="font-medium text-slate-300">{roleName}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden="true" /> What is GEM doing for me?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {signals.available ? (
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-300">
                    <FolderKanban className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> Active projects
                  </span>
                  <span className="font-bold text-white">{signals.activeProjects}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-300">
                    <ClipboardList className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> Open service requests
                  </span>
                  <span className="font-bold text-white">{signals.openRequests}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">Pending approvals</span>
                  <span className="font-bold text-white">{signals.pendingApprovals}</span>
                </li>
              </ul>
            ) : (
              <p className="text-xs leading-5 text-slate-500">{unavailableCopy}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <ClipboardList className="h-4 w-4 text-amber-300" aria-hidden="true" /> What do I need to do now?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!signals.available ? (
              <p className="text-xs leading-5 text-slate-500">{unavailableCopy}</p>
            ) : signals.actionItems.length ? (
              <ul className="space-y-2">
                {signals.actionItems.map((item) => {
                  const body = (
                    <>
                      <p className="truncate text-xs font-semibold text-white group-hover:text-cyan-200">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{item.detail}</p>
                    </>
                  );
                  return (
                    <li key={`${item.kind}:${item.id}`}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="group block rounded-lg border border-white/8 bg-white/[0.02] p-2.5 transition hover:border-cyan-300/25"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div>
                <p className="text-xs leading-5 text-slate-500">No action items recorded yet.</p>
                <Link
                  href="/app/requests"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Open a service request <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-black/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <CalendarClock className="h-4 w-4 text-cyan-300" aria-hidden="true" /> What happens next?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!signals.available ? (
              <p className="text-xs leading-5 text-slate-500">{unavailableCopy}</p>
            ) : signals.nextEvent ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {signals.nextEvent.kind === "milestone" ? "Next project milestone" : "Next meeting"}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{signals.nextEvent.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {signals.nextEvent.dateLabel ?? "No date recorded"}
                </p>
                <Link
                  href={signals.nextEvent.href}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-xs leading-5 text-slate-500">
                  No upcoming milestones or meetings recorded yet.
                </p>
                <Link
                  href="/app/meetings"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Request a meeting <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
