import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth";

const SECRET_KEY_NAMES = new Set([
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "clientsecret",
  "client_secret",
  "password",
  "authorization",
  "cookie",
  "credential",
  "credentials",
  "secret",
  "secretref",
  "secret_ref",
]);

function isSecretKey(key: string) {
  const normalized = key.replace(/[-\s.]/g, "_").replace(/_/g, "").toLowerCase();
  const separatorAware = key.toLowerCase().split(/[-_\s.]+/);
  return SECRET_KEY_NAMES.has(normalized) || separatorAware.some((part) => SECRET_KEY_NAMES.has(part));
}

export class TokMetricError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function correlationId(request?: NextRequest) {
  return request?.headers.get("x-correlation-id") || crypto.randomUUID();
}

export function redactSecrets(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, isSecretKey(key) ? "[REDACTED]" : redactSecrets(entry)]));
  }
  return value;
}

export function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(sortForHash(value))).digest("hex");
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sortForHash(entry)]));
  }
  return value;
}

export async function requireTokMetricSession(request: NextRequest): Promise<SessionPayload> {
  const session = await getSessionFromRequest(request);
  if (!session) throw new TokMetricError(401, "UNAUTHENTICATED", "Authentication is required.");
  return session;
}

export async function requireActiveTokMetricSession(
  request: NextRequest,
): Promise<SessionPayload> {
  const session = await requireTokMetricSession(request);
  const account = await db.user.findUnique({
    where: { id: session.userId },
    select: { status: true, isActive: true },
  });
  if (!account || !account.isActive || account.status !== "active") {
    throw new TokMetricError(
      403,
      "ACCOUNT_NOT_ACTIVE",
      "An active approved account is required for this operation.",
    );
  }
  return session;
}

export async function requireWorkspaceAccess(workspaceId: string, session: SessionPayload) {
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: session.userId } }, include: { role: { include: { permissions: true } } } });
  if (!membership && !["admin", "super_admin", "internal"].includes(session.role)) {
    throw new TokMetricError(403, "WORKSPACE_FORBIDDEN", "You do not have access to this TokMetric workspace.");
  }
  return membership;
}

export function requirePermission(membership: Awaited<ReturnType<typeof requireWorkspaceAccess>>, action: string, scope: string) {
  if (!membership) return;
  const allowed = membership.role?.permissions.some((permission) => permission.action === action && (permission.scope === scope || permission.scope === "*"));
  if (!allowed) throw new TokMetricError(403, "PERMISSION_DENIED", "The requested TokMetric permission is not granted.");
}

export async function enforceEmergencyLocks(workspaceId: string, action: "publish" | "advertise" | "shop_write" | "connector") {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new TokMetricError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  const blocked = workspace.globalEmergencyLock ||
    (action === "publish" && workspace.publishingDisabled) ||
    (action === "advertise" && workspace.advertisingDisabled) ||
    (action === "shop_write" && workspace.shopWriteDisabled) ||
    (action === "connector" && workspace.connectorDisabled);
  if (blocked) throw new TokMetricError(423, "TOKMETRIC_LOCKED", "TokMetric emergency controls block this action.");
}

export async function emitTokMetricAudit(input: { workspaceId?: string; actorId?: string; action: string; entityType: string; entityId?: string; correlationId: string; outcome: string; metadata?: unknown; sourceChannel: string }) {
  await db.auditEvent.create({ data: { workspaceId: input.workspaceId, actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, correlationId: input.correlationId, outcome: input.outcome, sourceChannel: input.sourceChannel, safeMetadata: redactSecrets(input.metadata ?? {}) as object } });
}

export async function emitDomainEvent(input: { workspaceId: string; aggregateType: string; aggregateId: string; eventType: string; correlationId: string; metadata?: unknown }) {
  await db.domainEvent.create({ data: { ...input, safeMetadata: redactSecrets(input.metadata ?? {}) as object } });
}

export function getTokMetricIdempotencyTtlSeconds() {
  const raw = process.env.TOKMETRIC_IDEMPOTENCY_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : 86400;
  if (!Number.isFinite(parsed) || parsed < 60 || parsed > 60 * 60 * 24 * 30) return 86400;
  return parsed;
}

export async function withIdempotency<T>(
  workspaceId: string,
  key: string | undefined,
  requestBody: unknown,
  work: () => Promise<{ statusCode: number; response: T }>,
  idempotencyPayload?: unknown,
) {
  if (!key) return work();
  const requestHash = contentHash(idempotencyPayload ?? requestBody);
  const existing = await db.idempotencyRecord.findUnique({ where: { workspaceId_key: { workspaceId, key } } });
  if (existing) {
    if (existing.requestHash !== requestHash) throw new TokMetricError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key was reused with a different request.");
    return { statusCode: existing.statusCode, response: existing.response as T };
  }
  const result = await work();
  await db.idempotencyRecord.create({ data: { workspaceId, key, requestHash, response: result.response as object, statusCode: result.statusCode, expiresAt: new Date(Date.now() + getTokMetricIdempotencyTtlSeconds() * 1000) } });
  return result;
}

export async function parseJson<T extends z.ZodTypeAny>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  const json = await request.json().catch(() => { throw new TokMetricError(400, "INVALID_JSON", "Request body must be valid JSON."); });
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new TokMetricError(400, "VALIDATION_ERROR", "Request validation failed.");
  return parsed.data;
}

export function tokMetricErrorResponse(error: unknown, cid: string) {
  const safe = error instanceof TokMetricError ? error : new TokMetricError(500, "INTERNAL_ERROR", "An unexpected TokMetric error occurred.");
  return NextResponse.json({ ok: false, error: { code: safe.code, message: safe.message, correlationId: cid } }, { status: safe.status });
}
