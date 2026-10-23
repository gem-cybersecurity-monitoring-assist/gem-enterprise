export const SENTINEL_PANTHER_IDENTITY = {
  name: "Sentinel Panther",
  operator: "Gem",
  organization: "GEM Enterprise",
  role: "command-center companion",
} as const;

export const GEM_VERTICALS = [
  "open_guardians",
  "nexus_financial",
  "alliance_trust_realty",
  "crypto_signal_bot",
  "esim_infrastructure",
  "ai_agent_tooling",
] as const;

export type GemVertical = (typeof GEM_VERTICALS)[number];

export const SENTINEL_STATES = [
  "INTAKE",
  "SCOPED",
  "EXECUTING",
  "WAITING_OPERATOR",
  "BLOCKED",
  "VERIFYING",
  "COMPLETE_EVIDENCED",
] as const;

export type SentinelState = (typeof SENTINEL_STATES)[number];

export const SENTINEL_ANIMATIONS = [
  "idle",
  "run_right",
  "run_left",
  "wave",
  "jump",
  "failure_reaction",
  "waiting",
  "active_work",
  "review",
] as const;

export type SentinelAnimation = (typeof SENTINEL_ANIMATIONS)[number];
export type SentinelMotionCue = "FORWARD_ROUTING" | "DEPENDENCY_RECOVERY";

export const CRYPTO_SIGNAL_BOT_POLICY = {
  repository: "support371/crypto-signal-bot",
  branch: "feat/regulated-live-foundation",
  tradingMode: "paper",
  allowMainnet: false,
  liveOrders: false,
  withdrawals: false,
  realFunds: false,
} as const;

export interface SentinelSessionContext {
  vertical?: GemVertical;
  phase?: string;
  blocker?: string;
  repository?: string;
  branch?: string;
}

export type EvidenceCheckStatus = "confirmed" | "failed" | "pending";

export interface SentinelEvidence {
  references: string[];
  checks: Array<{
    id: string;
    status: EvidenceCheckStatus;
    detail?: string;
  }>;
}

export interface SentinelOperationIntent {
  tradingMode?: "none" | "paper" | "live";
  allowMainnet?: boolean;
  liveOrders?: boolean;
  withdrawals?: boolean;
  realFunds?: boolean;
  externalAction?: boolean;
}

export type SentinelDecisionCode =
  | "ALLOWED"
  | "INTAKE_INCOMPLETE"
  | "INVALID_TRANSITION"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_CHECK_FAILED"
  | "EVIDENCE_CHECK_PENDING"
  | "CRYPTO_CONTEXT_MISMATCH"
  | "PAPER_TRADING_REQUIRED"
  | "LIVE_TRADING_DISABLED"
  | "MAINNET_DISABLED"
  | "LIVE_ORDERS_DISABLED"
  | "WITHDRAWALS_DISABLED"
  | "REAL_FUNDS_DISABLED"
  | "EXTERNAL_ACTION_DISABLED";

export interface SentinelDecision {
  allowed: boolean;
  code: SentinelDecisionCode;
  state: SentinelState;
  requestedState: SentinelState;
  animation: SentinelAnimation;
  nextQuestion: string | null;
  evidenceConfirmed: boolean;
  externalActionTaken: false;
}
