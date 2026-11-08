import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

// Gateway transactional adapter: social publishing edge function.
//
// Exposes the gem_social_* Postgres RPCs (supabase/migrations/
// 20261108050000_social_publishing_gateway_rpcs.sql) as typed actions over
// the existing invokeGateway pattern. The cron routes have no user session,
// so the caller authenticates with a machine secret
// (SOCIAL_GATEWAY_ADAPTER_SECRET, same value in Vercel and Supabase),
// verified with a timing-safe comparison, mirroring the CRON_SECRET bearer
// pattern in the process routes. The anon key alone is not sufficient: it
// is public by design.
//
// Authentication note: this function is deployed with verify_jwt = false
// (see supabase/config.toml). The platform JWT check would reject a
// non-JWT bearer, and the machine secret is the only authentication this
// function performs. The anon key still travels in the `apikey` header so
// the platform can route the request to the project.
//
// The function never logs request bodies or RPC rows: the credential-load
// action returns a row that includes the secret_ref ciphertext, and it must
// only ever travel back to the Next.js runtime (where decryption runs).
// Error responses carry the stable TokMetricError codes (so
// SOCIAL_PUBLISHING_CLAIM_LOST etc. survive the hop) but never raw
// Postgres error text.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADAPTER_SECRET = Deno.env.get("SOCIAL_GATEWAY_ADAPTER_SECRET") ?? "";
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADAPTER_SECRET) {
  throw new Error("Missing Supabase runtime configuration");
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.gemcybersecurityassist.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class GatewayError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Constant-time comparison for equal-length secrets. A length mismatch
// returns false immediately; the length of a random secret is not sensitive.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function requireAdapterSecret(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new GatewayError(401, "UNAUTHORIZED", "Adapter authentication required");
  }
  const supplied = header.slice("Bearer ".length);
  if (!supplied || !timingSafeEqual(supplied, ADAPTER_SECRET)) {
    throw new GatewayError(401, "UNAUTHORIZED", "Adapter authentication failed");
  }
}

// HTTP status for a business-error envelope returned by an RPC. Unknown
// codes are a server bug, not a client error.
const BUSINESS_ERROR_STATUS: Record<string, number> = {
  SOCIAL_PUBLISHING_CLAIM_LOST: 409,
  SOCIAL_PUBLISHING_IDEMPOTENCY_CONFLICT: 409,
  SOCIAL_CONNECTOR_NOT_FOUND: 404,
  SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND: 404,
  WORKSPACE_NOT_FOUND: 404,
  TOKMETRIC_LOCKED: 423,
  SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED: 503,
  INVALID_WORKSPACE_ACTION: 400,
};

function statusForBusinessCode(code: string): number {
  return BUSINESS_ERROR_STATUS[code] ?? 500;
}

interface RpcError {
  code?: string;
  message?: string;
}

// A failed RPC call is a provisioning or gateway failure, never a business
// error: the RPCs return business errors as JSON envelopes, not as raised
// exceptions. A missing function (PGRST202) or a missing table (42P01)
// means the adapter migration was not applied, which is the
// STORE_NOT_PROVISIONED case the Prisma path reports as 503.
function rpcFailure(error: RpcError): never {
  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";
  if (
    code === "PGRST202" ||
    message.includes("Could not find the function") ||
    code === "42P01" ||
    message.includes("does not exist")
  ) {
    throw new GatewayError(
      503,
      "SOCIAL_PUBLISHING_STORE_NOT_PROVISIONED",
      "The governed social publishing queue has not been provisioned.",
    );
  }
  console.error("social publishing gateway RPC failed", error);
  throw new GatewayError(
    503,
    "SOCIAL_PUBLISHING_GATEWAY_RPC_FAILED",
    "The social publishing gateway is unavailable.",
  );
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The RPCs that return a JSON object always return one. A malformed
// response is a server bug; fail with a 500 rather than a safe-looking
// default (a default of { ok: true } or { paused: false } would be
// fail-open for the locks and pause checks).
function requireRecord(data: unknown): JsonRecord {
  if (!isRecord(data)) {
    throw new GatewayError(
      500,
      "INTERNAL_ERROR",
      "Gateway returned an unexpected response.",
    );
  }
  return data;
}

// The RPCs that return a business envelope ({ ok, code, message }) signal
// failure through it. Convert it to the matching GatewayError so the
// client preserves the code and status.
function throwOnBusinessError(data: unknown): void {
  if (!isRecord(data) || data.ok !== false) return;
  const code = typeof data.code === "string" ? data.code : "INTERNAL_ERROR";
  const message =
    typeof data.message === "string" ? data.message : "Gateway request failed.";
  throw new GatewayError(statusForBusinessCode(code), code, message);
}

function stringParam(body: JsonRecord, name: string): string {
  const value = body[name];
  if (typeof value !== "string") {
    throw new GatewayError(400, "VALIDATION_ERROR", `Missing required parameter: ${name}`);
  }
  return value;
}

function optionalStringParam(body: JsonRecord, name: string): string | null {
  const value = body[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new GatewayError(400, "VALIDATION_ERROR", `Invalid parameter: ${name}`);
  }
  return value;
}

function optionalNumberParam(body: JsonRecord, name: string): number | null {
  const value = body[name];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GatewayError(400, "VALIDATION_ERROR", `Invalid parameter: ${name}`);
  }
  return value;
}

function optionalBooleanParam(body: JsonRecord, name: string): boolean {
  const value = body[name];
  return value === true;
}

function jsonParam(body: JsonRecord, name: string): unknown {
  return body[name] ?? null;
}

async function claimJobs(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_claim_jobs", {
    p_now: stringParam(body, "now"),
    p_slot_end: optionalStringParam(body, "slotEnd"),
    p_claim_id: stringParam(body, "claimId"),
    p_claim_expires_at: stringParam(body, "claimExpiresAt"),
    p_limit: optionalNumberParam(body, "limit") ?? 10,
    p_spacing_minutes: jsonParam(body, "spacingMinutes") ?? {},
    p_slot_caps: jsonParam(body, "slotCaps") ?? {},
  });
  if (error) rpcFailure(error);
  return { jobs: Array.isArray(data) ? data : [] };
}

async function loadCredential(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_load_connector_credential", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_connector_id: stringParam(body, "connectorId"),
  });
  if (error) rpcFailure(error);
  const rows = Array.isArray(data) ? data : [];
  if (!rows[0]) {
    throw new GatewayError(
      404,
      "SOCIAL_CONNECTOR_CREDENTIAL_NOT_FOUND",
      "Active social connector authorization was not found.",
    );
  }
  return { row: rows[0] };
}

async function governanceEvidence(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_governance_evidence", {
    p_approval_id: stringParam(body, "approvalId"),
    p_workspace_id: stringParam(body, "workspaceId"),
    p_approved_version_hash: stringParam(body, "approvedVersionHash"),
    p_compliance_review_id: stringParam(body, "complianceReviewId"),
  });
  if (error) rpcFailure(error);
  return requireRecord(data);
}

async function workspaceLocks(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_workspace_locks", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_action: stringParam(body, "action"),
  });
  if (error) rpcFailure(error);
  throwOnBusinessError(data);
  return requireRecord(data);
}

async function pauseState(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_pause_state", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_provider: stringParam(body, "provider"),
  });
  if (error) rpcFailure(error);
  return requireRecord(data);
}

async function markPublished(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_mark_published", {
    p_job_id: stringParam(body, "jobId"),
    p_claim_id: stringParam(body, "claimId"),
    p_external_post_id: stringParam(body, "externalPostId"),
    p_external_post_url: optionalStringParam(body, "externalPostUrl"),
    p_provider_status_code: optionalNumberParam(body, "providerStatusCode"),
    p_safe_metadata: jsonParam(body, "safeMetadata") ?? {},
    p_now: stringParam(body, "now"),
  });
  if (error) rpcFailure(error);
  const rows = Array.isArray(data) ? data : [];
  if (!rows[0]) {
    throw new GatewayError(
      409,
      "SOCIAL_PUBLISHING_CLAIM_LOST",
      "The publishing job claim expired before completion.",
    );
  }
  return { job: rows[0] };
}

async function markBlocked(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_mark_blocked", {
    p_job_id: stringParam(body, "jobId"),
    p_claim_id: stringParam(body, "claimId"),
    p_error_code: stringParam(body, "errorCode"),
    p_error_message: stringParam(body, "errorMessage"),
    p_safe_metadata: jsonParam(body, "safeMetadata") ?? {},
    p_now: stringParam(body, "now"),
  });
  if (error) rpcFailure(error);
  const rows = Array.isArray(data) ? data : [];
  if (!rows[0]) {
    throw new GatewayError(
      409,
      "SOCIAL_PUBLISHING_CLAIM_LOST",
      "The publishing job claim expired before it could be blocked.",
    );
  }
  return { job: rows[0] };
}

async function markFailed(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_mark_failed", {
    p_job_id: stringParam(body, "jobId"),
    p_claim_id: stringParam(body, "claimId"),
    p_state: stringParam(body, "state"),
    p_next_attempt_at: stringParam(body, "nextAttemptAt"),
    p_completed_at: optionalStringParam(body, "completedAt"),
    p_error_code: stringParam(body, "errorCode"),
    p_error_message: stringParam(body, "errorMessage"),
    p_provider_status_code: optionalNumberParam(body, "providerStatusCode"),
    p_safe_metadata: jsonParam(body, "safeMetadata") ?? {},
    p_outcome: stringParam(body, "outcome"),
    p_now: stringParam(body, "now"),
  });
  if (error) rpcFailure(error);
  const rows = Array.isArray(data) ? data : [];
  if (!rows[0]) {
    throw new GatewayError(
      409,
      "SOCIAL_PUBLISHING_CLAIM_LOST",
      "The publishing job claim expired before failure handling completed.",
    );
  }
  return { job: rows[0] };
}

async function markReauthorization(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_mark_reauthorization", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_connector_id: stringParam(body, "connectorId"),
    p_metadata: jsonParam(body, "metadata") ?? {},
  });
  if (error) rpcFailure(error);
  return requireRecord(data);
}

async function auditEvent(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_audit_event", {
    p_workspace_id: optionalStringParam(body, "workspaceId"),
    p_actor_id: optionalStringParam(body, "actorId"),
    p_action: stringParam(body, "action"),
    p_entity_type: stringParam(body, "entityType"),
    p_entity_id: optionalStringParam(body, "entityId"),
    p_correlation_id: stringParam(body, "correlationId"),
    p_outcome: stringParam(body, "outcome"),
    p_source_channel: stringParam(body, "sourceChannel"),
    p_safe_metadata: jsonParam(body, "safeMetadata") ?? {},
  });
  if (error) rpcFailure(error);
  return requireRecord(data);
}

async function createJob(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_create_job", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_provider: stringParam(body, "provider"),
    p_connector_id: stringParam(body, "connectorId"),
    p_content_type: stringParam(body, "contentType"),
    p_content_version_hash: stringParam(body, "contentVersionHash"),
    p_approved_version_hash: stringParam(body, "approvedVersionHash"),
    p_approval_id: stringParam(body, "approvalId"),
    p_compliance_review_id: stringParam(body, "complianceReviewId"),
    p_compliance_passed: optionalBooleanParam(body, "compliancePassed"),
    p_idempotency_key: stringParam(body, "idempotencyKey"),
    p_payload: jsonParam(body, "payload") ?? {},
    p_local_context: optionalStringParam(body, "localContext"),
    p_max_attempts: optionalNumberParam(body, "maxAttempts") ?? 3,
    p_next_attempt_at: stringParam(body, "nextAttemptAt"),
    p_requested_by_id: optionalStringParam(body, "requestedById"),
    p_scheduled_for: optionalStringParam(body, "scheduledFor"),
    p_now: stringParam(body, "now"),
  });
  if (error) rpcFailure(error);
  throwOnBusinessError(data);
  return requireRecord(data);
}

async function listJobs(body: JsonRecord) {
  const { data, error } = await db.rpc("gem_social_list_jobs", {
    p_workspace_id: stringParam(body, "workspaceId"),
    p_limit: optionalNumberParam(body, "limit") ?? 50,
  });
  if (error) rpcFailure(error);
  return { jobs: Array.isArray(data) ? data : [] };
}

async function health() {
  const { data, error } = await db.rpc("gem_social_health", {});
  if (error) rpcFailure(error);
  return requireRecord(data);
}

function phase2NotImplemented(action: string): never {
  throw new GatewayError(
    400,
    "SOCIAL_PUBLISHING_PHASE2_NOT_IMPLEMENTED",
    `Phase 2 adapter action ${action} is not implemented. Autopilot stays gateway-blocked.`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  try {
    let body: JsonRecord;
    try {
      body = (await req.json()) as JsonRecord;
    } catch {
      throw new GatewayError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    if (!isRecord(body)) {
      throw new GatewayError(400, "INVALID_JSON", "Request body must be a JSON object.");
    }
    requireAdapterSecret(req);
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "health") return json(await health());
    if (action === "claim_jobs") return json(await claimJobs(body));
    if (action === "load_credential") return json(await loadCredential(body));
    if (action === "governance_evidence") return json(await governanceEvidence(body));
    if (action === "workspace_locks") return json(await workspaceLocks(body));
    if (action === "pause_state") return json(await pauseState(body));
    if (action === "mark_published") return json(await markPublished(body));
    if (action === "mark_blocked") return json(await markBlocked(body));
    if (action === "mark_failed") return json(await markFailed(body));
    if (action === "mark_reauthorization") return json(await markReauthorization(body));
    if (action === "audit_event") return json(await auditEvent(body));
    if (action === "create_job") return json(await createJob(body));
    if (action === "list_jobs") return json(await listJobs(body));
    // Phase 2 actions are reserved names only. The autopilot service has
    // its own Prisma surface and stays gateway-blocked until its own phase.
    if (
      action === "count_jobs" ||
      action === "fingerprint_check" ||
      action === "cancel_autopilot_jobs"
    ) {
      phase2NotImplemented(action);
    }
    throw new GatewayError(400, "UNKNOWN_ACTION", "Unknown action");
  } catch (error) {
    if (error instanceof GatewayError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error(error);
    return json({ error: "Internal gateway error", code: "INTERNAL_ERROR" }, 500);
  }
});
