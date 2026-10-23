import crypto from "node:crypto";
import { TokMetricError } from "@/lib/tokmetric/security";

export interface ExperianStatePayload {
  nonce: string;
  workspaceId: string;
  actorId: string;
  createdAt: number;
}
function signingKey() {
  const material =
    process.env.EXPERIAN_STATE_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.EXPERIAN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!material) {
    throw new TokMetricError(
      503,
      "EXPERIAN_NOT_CONFIGURED",
      "Experian authorization state signing is not configured.",
    );
  }
  return crypto.createHash("sha256").update("gem-experian-state:v1:").update(material).digest();
}

export function encodeExperianState(payload: ExperianStatePayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function decodeExperianState(value: string): ExperianStatePayload {
  const [body, signature] = value.split(".");
  if (!body || !signature) {
    throw new TokMetricError(401, "EXPERIAN_STATE_INVALID", "Experian authorization state is invalid.");
  }
  const expected = crypto.createHmac("sha256", signingKey()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new TokMetricError(
      401,
      "EXPERIAN_STATE_MISMATCH",
      "Experian authorization state validation failed.",
    );
  }

  let parsed: Partial<ExperianStatePayload>;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<ExperianStatePayload>;
  } catch {
    throw new TokMetricError(401, "EXPERIAN_STATE_INVALID", "Experian authorization state is invalid.");
  }
  if (!parsed.nonce || !parsed.workspaceId || !parsed.actorId || typeof parsed.createdAt !== "number") {
    throw new TokMetricError(401, "EXPERIAN_STATE_INVALID", "Experian authorization state is incomplete.");
  }
  if (Date.now() - parsed.createdAt > 10 * 60 * 1000 || parsed.createdAt > Date.now() + 60_000) {
    throw new TokMetricError(401, "EXPERIAN_STATE_EXPIRED", "Experian authorization state expired.");
  }
  return {
    nonce: parsed.nonce,
    workspaceId: parsed.workspaceId,
    actorId: parsed.actorId,
    createdAt: parsed.createdAt,
  };
}
