import { evaluatePolicy } from "@/lib/policy/evaluate-policy";
import { resolveQueue } from "@/lib/policy/resolve-queue";
import { generateGemSupportReply } from "@/lib/ai/gem-support-agent";
import type { SupportSession, OrchestrationResult } from "@/types/support";

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function orchestrateSupportReply(
  message: string,
  session: SupportSession
): Promise<OrchestrationResult> {
  // Policy evaluation (synchronous, runs first)
  const policyResult = evaluatePolicy(message);

  // Build AI-friendly history (last 10 messages to stay within token budget)
  const history = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(0, -1)
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // If policy demands escalation, still get a brief reply before handing off
  if (policyResult.shouldEscalate) {
    const queue = resolveQueue({ policyResult, userTier: session.userTier });
    const escalationReply =
      policyResult.path === "escalate" && policyResult.escalationReason === "incident_detected"
        ? "Your message may involve a security incident, so I will route it to the Cybersecurity Incident queue and create a tracked case for authorized human review."
        : "Understood. I will create a tracked support case and route it to the appropriate human-support queue.";

    return {
      reply: escalationReply,
      action: "escalate",
      shouldEscalate: true,
      escalationReason: policyResult.escalationReason,
      queue,
      responseSource: "policy",
      metadata: { restrictedClass: policyResult.restrictedClass },
    };
  }

  // Booking path
  if (policyResult.path === "booking") {
    return {
      reply:
        "You can request a consultation through Meetings. Submit your preferred time and details there; the request remains pending until the GEM team confirms it.",
      action: "booking",
      shouldEscalate: false,
      queue: "Consultation Scheduling",
      responseSource: "policy",
      knowledgeLinks: [
        {
          title: "Meetings",
          href: "/app/meetings",
          description: "Request and review meetings with the GEM team.",
        },
      ],
    };
  }

  const aiReply = await generateGemSupportReply({
    message,
    history,
    userId: session.userId,
    userTier: session.userTier,
  });

  return {
    reply: aiReply.text,
    action: "continue",
    shouldEscalate: false,
    queue: policyResult.path === "billing" ? "Billing / Accounts" : undefined,
    knowledgeLinks: aiReply.knowledgeLinks,
    suggestedReplies: aiReply.suggestedReplies,
    responseSource: aiReply.source,
    providerStatus: aiReply.providerStatus,
    metadata: {
      model: aiReply.model,
      usage: aiReply.usage,
    },
  };
}
