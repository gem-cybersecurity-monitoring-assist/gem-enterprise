import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  getRequestContext,
  requirePlatformOwner,
} from "@/lib/api/auth-helpers";
import { emitAuditLog } from "@/lib/audit";
import {
  GEM_VERTICALS,
  SENTINEL_STATES,
} from "@/lib/sentinel-panther/contract";
import {
  evaluateSentinelTransition,
  type SentinelTransitionInput,
} from "@/lib/sentinel-panther/runtime";

export const dynamic = "force-dynamic";

const schema = z.object({
  state: z.enum(SENTINEL_STATES),
  requestedState: z.enum(SENTINEL_STATES),
  context: z.object({
    vertical: z.enum(GEM_VERTICALS).optional(),
    phase: z.string().trim().min(1).max(120).optional(),
    blocker: z.string().trim().min(1).max(500).optional(),
    repository: z.string().trim().min(1).max(200).optional(),
    branch: z.string().trim().min(1).max(200).optional(),
  }),
  operation: z
    .object({
      tradingMode: z.enum(["none", "paper", "live"]).optional(),
      allowMainnet: z.boolean().optional(),
      liveOrders: z.boolean().optional(),
      withdrawals: z.boolean().optional(),
      realFunds: z.boolean().optional(),
      externalAction: z.boolean().optional(),
    })
    .optional(),
  evidence: z
    .object({
      references: z.array(z.string().trim().min(1).max(500)).max(50),
      checks: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            status: z.enum(["confirmed", "failed", "pending"]),
            detail: z.string().trim().max(500).optional(),
          }),
        )
        .max(100),
    })
    .optional(),
  motionCue: z.enum(["FORWARD_ROUTING", "DEPENDENCY_RECOVERY"]).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePlatformOwner();
  if (!gate.ok) return gate.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest("Invalid Sentinel Panther transition request.", parsed.error.flatten());
  }

  const transition = parsed.data as SentinelTransitionInput;
  const decision = evaluateSentinelTransition(transition);
  const requestContext = getRequestContext(request);
  await emitAuditLog({
    userId: gate.session.userId,
    action: "admin_action",
    resource: "sentinel_panther_transition",
    metadata: {
      from: parsed.data.state,
      requested: parsed.data.requestedState,
      result: decision.state,
      allowed: decision.allowed,
      code: decision.code,
      vertical: parsed.data.context.vertical ?? null,
      externalActionTaken: false,
    },
    ...requestContext,
  });

  return json(decision, decision.allowed ? 200 : 422);
}
