import {
  CRYPTO_SIGNAL_BOT_POLICY,
  type SentinelAnimation,
  type SentinelDecision,
  type SentinelDecisionCode,
  type SentinelEvidence,
  type SentinelMotionCue,
  type SentinelOperationIntent,
  type SentinelSessionContext,
  type SentinelState,
} from "@/lib/sentinel-panther/contract";

const transitions: Record<SentinelState, readonly SentinelState[]> = {
  INTAKE: ["INTAKE", "SCOPED"],
  SCOPED: ["SCOPED", "EXECUTING", "BLOCKED"],
  EXECUTING: ["EXECUTING", "WAITING_OPERATOR", "BLOCKED", "VERIFYING"],
  WAITING_OPERATOR: ["WAITING_OPERATOR", "EXECUTING", "BLOCKED"],
  BLOCKED: ["BLOCKED", "WAITING_OPERATOR", "EXECUTING"],
  VERIFYING: ["VERIFYING", "EXECUTING", "BLOCKED", "COMPLETE_EVIDENCED"],
  COMPLETE_EVIDENCED: ["COMPLETE_EVIDENCED", "INTAKE"],
};

const stateAnimations: Record<SentinelState, SentinelAnimation> = {
  INTAKE: "wave",
  SCOPED: "idle",
  EXECUTING: "active_work",
  WAITING_OPERATOR: "waiting",
  BLOCKED: "failure_reaction",
  VERIFYING: "review",
  COMPLETE_EVIDENCED: "jump",
};

const questions = {
  vertical: "What vertical?",
  phase: "What phase?",
  blocker: "What's the current blocker?",
} as const;

export function nextIntakeField(
  context: SentinelSessionContext,
): keyof typeof questions | null {
  if (!context.vertical) return "vertical";
  if (!context.phase?.trim()) return "phase";
  if (!context.blocker?.trim()) return "blocker";
  return null;
}

export function nextIntakeQuestion(context: SentinelSessionContext): string | null {
  const field = nextIntakeField(context);
  return field ? questions[field] : null;
}

export function animationForState(
  state: SentinelState,
  motionCue?: SentinelMotionCue,
): SentinelAnimation {
  if (motionCue === "FORWARD_ROUTING") return "run_right";
  if (motionCue === "DEPENDENCY_RECOVERY") return "run_left";
  return stateAnimations[state];
}

function evaluateSafety(
  context: SentinelSessionContext,
  operation: SentinelOperationIntent,
  requestedState: SentinelState,
): SentinelDecisionCode | null {
  if (operation.externalAction) return "EXTERNAL_ACTION_DISABLED";
  if (operation.allowMainnet) return "MAINNET_DISABLED";
  if (operation.liveOrders) return "LIVE_ORDERS_DISABLED";
  if (operation.withdrawals) return "WITHDRAWALS_DISABLED";
  if (operation.realFunds) return "REAL_FUNDS_DISABLED";
  if (operation.tradingMode === "live") return "LIVE_TRADING_DISABLED";

  if (
    context.vertical === "crypto_signal_bot" &&
    requestedState === "EXECUTING"
  ) {
    if (
      context.repository !== CRYPTO_SIGNAL_BOT_POLICY.repository ||
      context.branch !== CRYPTO_SIGNAL_BOT_POLICY.branch
    ) {
      return "CRYPTO_CONTEXT_MISMATCH";
    }
    if (operation.tradingMode !== "paper") {
      return "PAPER_TRADING_REQUIRED";
    }
  }

  return null;
}

function evaluateEvidence(evidence?: SentinelEvidence): SentinelDecisionCode | null {
  if (!evidence?.references.length || !evidence.checks.length) {
    return "EVIDENCE_REQUIRED";
  }
  if (evidence.checks.some((check) => check.status === "failed")) {
    return "EVIDENCE_CHECK_FAILED";
  }
  if (evidence.checks.some((check) => check.status !== "confirmed")) {
    return "EVIDENCE_CHECK_PENDING";
  }
  return null;
}

export interface SentinelTransitionInput {
  state: SentinelState;
  requestedState: SentinelState;
  context: SentinelSessionContext;
  operation?: SentinelOperationIntent;
  evidence?: SentinelEvidence;
  motionCue?: SentinelMotionCue;
}

export function evaluateSentinelTransition(
  input: SentinelTransitionInput,
): SentinelDecision {
  const nextQuestion = nextIntakeQuestion(input.context);
  let code: SentinelDecisionCode = "ALLOWED";

  const safetyFailure = evaluateSafety(
    input.context,
    input.operation ?? {},
    input.requestedState,
  );
  if (safetyFailure) {
    code = safetyFailure;
  } else if (!transitions[input.state].includes(input.requestedState)) {
    code = "INVALID_TRANSITION";
  } else if (input.requestedState === "SCOPED" && nextQuestion) {
    code = "INTAKE_INCOMPLETE";
  } else if (input.requestedState === "COMPLETE_EVIDENCED") {
    code = evaluateEvidence(input.evidence) ?? "ALLOWED";
  }

  const allowed = code === "ALLOWED";
  const state = allowed ? input.requestedState : input.state;

  return {
    allowed,
    code,
    state,
    requestedState: input.requestedState,
    animation: animationForState(
      allowed ? input.requestedState : code === "INTAKE_INCOMPLETE" ? "INTAKE" : "BLOCKED",
      allowed ? input.motionCue : undefined,
    ),
    nextQuestion,
    evidenceConfirmed:
      input.requestedState === "COMPLETE_EVIDENCED" &&
      allowed &&
      evaluateEvidence(input.evidence) === null,
    externalActionTaken: false,
  };
}
