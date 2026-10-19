import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import {
  getLatestVerificationApplication,
  toVerificationApplicationView,
} from "@/lib/kyc/service";

const stageIndex: Record<string, number> = {
  draft: 0,
  consented: 0,
  submitted: 1,
  under_review: 2,
  needs_information: 2,
  approved: 3,
  rejected: 3,
  closed: 3,
};

const statusText: Record<string, { label: string; description: string }> = {
  draft: { label: "Draft", description: "The application has not been submitted." },
  consented: { label: "Consent recorded", description: "The application is ready for submission." },
  submitted: { label: "Queued for review", description: "The application is waiting for an available reviewer." },
  under_review: { label: "Under manual review", description: "An authorized reviewer is assessing the application." },
  needs_information: { label: "Additional information required", description: "Update the limited application fields and resubmit." },
  approved: { label: "Approved", description: "The manual application decision is approved. Service activation remains separate." },
  rejected: { label: "Not approved", description: "The manual application decision is not approved." },
  closed: { label: "Closed", description: "The application case is closed." },
};

const stages = ["Application prepared", "Submitted", "Manual review", "Outcome"];

export default async function VerificationStatusPage() {
  const session = await getSession();
  if (!session) redirect("/client-login?next=/kyc/status");

  const application = await getLatestVerificationApplication(session.userId);
  if (!application) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">No application found</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start a controlled manual-review application.</p>
        <Button asChild className="mt-6 bg-cyan-400 text-black hover:bg-cyan-300">
          <Link href="/kyc/start">Start application</Link>
        </Button>
      </div>
    );
  }

  const view = toVerificationApplicationView(application);
  const meta = statusText[view.workflowState];
  const currentStage = stageIndex[view.workflowState];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-cyan-400">Reference {view.reference}</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Application status</h1>
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start gap-4">
          {view.workflowState === "needs_information" || view.workflowState === "rejected" ? (
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-amber-400" />
          ) : view.workflowState === "approved" || view.workflowState === "closed" ? (
            <CheckCircle className="mt-1 h-6 w-6 shrink-0 text-green-400" />
          ) : (
            <Clock className="mt-1 h-6 w-6 shrink-0 text-cyan-400" />
          )}
          <div>
            <h2 className="text-lg font-semibold text-foreground">{meta.label}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-semibold text-foreground">Progress</h2>
        <div className="mt-5 space-y-4">
          {stages.map((stage, index) => (
            <div key={stage} className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index <= currentStage ? "bg-cyan-400 text-black" : "border border-white/15 text-muted-foreground"}`}>
                {index < currentStage ? "✓" : index + 1}
              </div>
              <span className={index <= currentStage ? "text-foreground" : "text-muted-foreground"}>{stage}</span>
            </div>
          ))}
        </div>
      </section>

      {(view.reviewNotes || view.rejectionReason) && (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-5">
          <h2 className="font-semibold text-amber-200">Reviewer message</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100/80">
            {view.rejectionReason || view.reviewNotes}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {view.workflowState === "needs_information" && (
          <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
            <Link href="/kyc/individual">Update and resubmit</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/contact">Contact support</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app/dashboard">Return to dashboard</Link>
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        This status concerns the manual application workflow only. It does not represent automated identity verification, payment approval, or immediate service activation.
      </p>
    </div>
  );
}
