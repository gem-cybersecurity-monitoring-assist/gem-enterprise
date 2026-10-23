import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  animationForState,
  evaluateSentinelTransition,
  nextIntakeQuestion,
} from "@/lib/sentinel-panther/runtime";

const cryptoContext = {
  vertical: "crypto_signal_bot" as const,
  phase: "regulated live foundation",
  blocker: "verification pending",
  repository: "support371/crypto-signal-bot",
  branch: "feat/regulated-live-foundation",
};

const routeSource = readFileSync(
  "src/app/api/command-center/sentinel-panther/route.ts",
  "utf8",
);

describe("Sentinel Panther governed runtime", () => {
  it("asks only the next missing intake question", () => {
    expect(nextIntakeQuestion({})).toBe("What vertical?");
    expect(nextIntakeQuestion({ vertical: "open_guardians" })).toBe("What phase?");
    expect(
      nextIntakeQuestion({ vertical: "open_guardians", phase: "delivery" }),
    ).toBe("What's the current blocker?");
    expect(
      nextIntakeQuestion({
        vertical: "open_guardians",
        phase: "delivery",
        blocker: "none",
      }),
    ).toBeNull();
  });

  it("allows a complete intake to become scoped", () => {
    const decision = evaluateSentinelTransition({
      state: "INTAKE",
      requestedState: "SCOPED",
      context: cryptoContext,
      operation: { tradingMode: "paper" },
    });

    expect(decision).toMatchObject({
      allowed: true,
      code: "ALLOWED",
      state: "SCOPED",
      animation: "idle",
      externalActionTaken: false,
    });
  });

  it("rejects incomplete intake and invalid transitions", () => {
    expect(
      evaluateSentinelTransition({
        state: "INTAKE",
        requestedState: "SCOPED",
        context: { vertical: "open_guardians" },
      }).code,
    ).toBe("INTAKE_INCOMPLETE");

    expect(
      evaluateSentinelTransition({
        state: "SCOPED",
        requestedState: "COMPLETE_EVIDENCED",
        context: cryptoContext,
      }).code,
    ).toBe("INVALID_TRANSITION");
  });

  it("requires references and confirmed checks before completion", () => {
    expect(
      evaluateSentinelTransition({
        state: "VERIFYING",
        requestedState: "COMPLETE_EVIDENCED",
        context: cryptoContext,
      }).code,
    ).toBe("EVIDENCE_REQUIRED");

    expect(
      evaluateSentinelTransition({
        state: "VERIFYING",
        requestedState: "COMPLETE_EVIDENCED",
        context: cryptoContext,
        evidence: {
          references: ["preview-build-123"],
          checks: [{ id: "unit-tests", status: "pending" }],
        },
      }).code,
    ).toBe("EVIDENCE_CHECK_PENDING");

    expect(
      evaluateSentinelTransition({
        state: "VERIFYING",
        requestedState: "COMPLETE_EVIDENCED",
        context: cryptoContext,
        evidence: {
          references: ["preview-build-123"],
          checks: [{ id: "unit-tests", status: "failed" }],
        },
      }).code,
    ).toBe("EVIDENCE_CHECK_FAILED");

    const completed = evaluateSentinelTransition({
      state: "VERIFYING",
      requestedState: "COMPLETE_EVIDENCED",
      context: cryptoContext,
      evidence: {
        references: ["preview-build-123"],
        checks: [{ id: "unit-tests", status: "confirmed" }],
      },
    });
    expect(completed).toMatchObject({
      allowed: true,
      state: "COMPLETE_EVIDENCED",
      animation: "jump",
      evidenceConfirmed: true,
    });
  });

  it.each([
    [{ tradingMode: "live" as const }, "LIVE_TRADING_DISABLED"],
    [{ allowMainnet: true }, "MAINNET_DISABLED"],
    [{ liveOrders: true }, "LIVE_ORDERS_DISABLED"],
    [{ withdrawals: true }, "WITHDRAWALS_DISABLED"],
    [{ realFunds: true }, "REAL_FUNDS_DISABLED"],
    [{ externalAction: true }, "EXTERNAL_ACTION_DISABLED"],
  ])("fails closed for prohibited operation %#", (operation, code) => {
    expect(
      evaluateSentinelTransition({
        state: "SCOPED",
        requestedState: "EXECUTING",
        context: cryptoContext,
        operation,
      }),
    ).toMatchObject({ allowed: false, code, state: "SCOPED", animation: "failure_reaction" });
  });

  it("rejects drift from the authorized crypto repository and branch", () => {
    expect(
      evaluateSentinelTransition({
        state: "SCOPED",
        requestedState: "EXECUTING",
        context: { ...cryptoContext, branch: "main" },
        operation: { tradingMode: "paper" },
      }).code,
    ).toBe("CRYPTO_CONTEXT_MISMATCH");
  });

  it("requires an explicit paper-trading intent before crypto execution", () => {
    expect(
      evaluateSentinelTransition({
        state: "SCOPED",
        requestedState: "EXECUTING",
        context: cryptoContext,
      }).code,
    ).toBe("PAPER_TRADING_REQUIRED");
  });

  it("maps lifecycle and routing cues to the approved motion set", () => {
    expect(animationForState("EXECUTING")).toBe("active_work");
    expect(animationForState("VERIFYING")).toBe("review");
    expect(animationForState("BLOCKED")).toBe("failure_reaction");
    expect(animationForState("EXECUTING", "FORWARD_ROUTING")).toBe("run_right");
    expect(animationForState("EXECUTING", "DEPENDENCY_RECOVERY")).toBe("run_left");
  });

  it("protects and audits the no-store API boundary", () => {
    expect(routeSource).toContain("requirePlatformOwner()");
    expect(routeSource).toContain("schema.safeParse");
    expect(routeSource).toContain("emitAuditLog");
    expect(routeSource).toContain('action: "admin_action"');
    expect(routeSource).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(routeSource).toContain("decision.allowed ? 200 : 422");
  });
});
