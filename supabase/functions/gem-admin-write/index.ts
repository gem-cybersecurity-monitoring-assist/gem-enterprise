import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import {
  dispatchTokMetricCommand,
  TokMetricCommandError,
} from "./tokmetric-command.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKMETRIC_WORKSPACE_ID = "ws_60488340ded94dcfab3b875ef9ae591c";
const MAX_ACTIVE_TOKMETRIC_CREDENTIALS = 5;
const ADMIN_ROLES = ["admin", "super_admin", "internal"] as const;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase runtime configuration");
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const encoder = new TextEncoder();
const decoder = new TextDecoder();
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
      "Referrer-Policy": "no-referrer",
    },
  });
}

function decodeB64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function validSessionVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

async function requireAdmin(token: unknown) {
  if (typeof token !== "string") {
    throw new GatewayError(401, "UNAUTHORIZED", "Authentication required");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new GatewayError(401, "INVALID_SESSION", "Invalid session token");
  }
  const unsigned = `${parts[0]}.${parts[1]}`;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    decodeB64url(parts[2]),
    encoder.encode(unsigned),
  );
  if (!valid) {
    throw new GatewayError(401, "INVALID_SESSION", "Invalid session token");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(
      decoder.decode(decodeB64url(parts[1])),
    ) as Record<string, unknown>;
  } catch {
    throw new GatewayError(401, "INVALID_SESSION", "Invalid session token");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const sessionVersion = payload.sessionVersion;
  if (
    !userId ||
    exp <= Math.floor(Date.now() / 1000) ||
    !validSessionVersion(sessionVersion)
  ) {
    throw new GatewayError(401, "SESSION_EXPIRED", "Session expired");
  }
  if (
    payload.iss !== "gem-auth-gateway" ||
    payload.aud !== "gem-enterprise"
  ) {
    throw new GatewayError(401, "INVALID_SESSION", "Invalid session issuer");
  }

  const { data: user, error } = await db
    .from("users")
    .select(
      "id,email,role,status,isActive,isEmailVerified,sessionVersion",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new GatewayError(503, "DATABASE_ERROR", error.message);
  }
  if (!user) {
    throw new GatewayError(401, "ACCOUNT_NOT_FOUND", "Account not found");
  }
  if (!user.isActive || user.status !== "active") {
    throw new GatewayError(403, "ACCOUNT_DISABLED", "Account is not active");
  }
  if (!validSessionVersion(user.sessionVersion)) {
    throw new GatewayError(
      503,
      "INVALID_SESSION_VERSION",
      "Session authority unavailable",
    );
  }
  if (user.sessionVersion !== sessionVersion) {
    throw new GatewayError(401, "SESSION_REVOKED", "Session revoked");
  }
  if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new GatewayError(403, "FORBIDDEN", "Administrator access required");
  }
  return user as {
    id: string;
    email: string;
    role: string;
    status: string;
    isActive: boolean;
    isEmailVerified: boolean;
    sessionVersion: number;
  };
}

function assignableRoles(actorRole: string) {
  if (actorRole === "super_admin" || actorRole === "internal") {
    return ["client", "analyst", "admin"];
  }
  if (actorRole === "admin") return ["client", "analyst"];
  return [];
}

async function audit(input: {
  userId: string;
  action: "role_change" | "admin_action";
  resourceId: string;
  metadata: Record<string, unknown>;
}) {
  const { error } = await db.from("audit_logs").insert({
    id: crypto.randomUUID(),
    userId: input.userId,
    action: input.action,
    resource: "user",
    resourceId: input.resourceId,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  });
  if (error) console.error("audit", error.message);
}

async function updateUser(
  actor: { id: string; role: string },
  body: Record<string, unknown>,
) {
  const id = typeof body.id === "string" ? body.id : "";
  const requestedRole = typeof body.role === "string" ? body.role : undefined;
  const requestedStatus =
    typeof body.status === "string" ? body.status : undefined;
  const requestedActive =
    typeof body.isActive === "boolean" ? body.isActive : undefined;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const confirmEmail =
    typeof body.confirmEmail === "string"
      ? body.confirmEmail.trim().toLowerCase()
      : "";
  if (!id || reason.length < 10) {
    throw new GatewayError(
      400,
      "INVALID_REQUEST",
      "Target and reason are required",
    );
  }

  const { data: target, error } = await db
    .from("users")
    .select(
      "id,email,role,status,isActive,isEmailVerified,sessionVersion",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new GatewayError(503, "DATABASE_ERROR", error.message);
  if (!target) throw new GatewayError(404, "USER_NOT_FOUND", "User not found");

  if (requestedRole) {
    if (target.id === actor.id) {
      throw new GatewayError(
        403,
        "SELF_ROLE_CHANGE_FORBIDDEN",
        "You cannot change your own role",
      );
    }
    if (["super_admin", "internal"].includes(target.role)) {
      throw new GatewayError(
        403,
        "PRIVILEGED_ROLE_OUT_OF_BAND_ONLY",
        "Protected roles require an out-of-band process",
      );
    }
    if (!assignableRoles(actor.role).includes(requestedRole)) {
      throw new GatewayError(
        403,
        "ROLE_ASSIGNMENT_FORBIDDEN",
        "Requested role is not assignable",
      );
    }
    if (confirmEmail !== target.email.toLowerCase()) {
      throw new GatewayError(
        400,
        "ROLE_CONFIRMATION_MISMATCH",
        "Email confirmation does not match",
      );
    }
    if (
      ["analyst", "admin"].includes(requestedRole) &&
      (!target.isActive ||
        target.status !== "active" ||
        !target.isEmailVerified)
    ) {
      throw new GatewayError(
        409,
        "REVIEWER_ACCOUNT_NOT_ELIGIBLE",
        "Reviewer roles require an active verified account",
      );
    }
  }

  if (
    target.id === actor.id &&
    (requestedActive === false || requestedStatus === "suspended")
  ) {
    throw new GatewayError(
      403,
      "SELF_SUSPENSION_FORBIDDEN",
      "You cannot suspend your own account",
    );
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (requestedRole && requestedRole !== target.role) update.role = requestedRole;
  if (requestedStatus && requestedStatus !== target.status) {
    update.status = requestedStatus;
  }
  if (requestedActive !== undefined && requestedActive !== target.isActive) {
    update.isActive = requestedActive;
  }
  if (Object.keys(update).length === 1) {
    throw new GatewayError(
      400,
      "NO_CHANGE",
      "Requested update does not change the account",
    );
  }
  update.sessionVersion =
    (validSessionVersion(target.sessionVersion) ? target.sessionVersion : 0) + 1;

  const { data, error: updateError } = await db
    .from("users")
    .update(update)
    .eq("id", target.id)
    .select(
      "id,email,role,status,isActive,isEmailVerified,sessionVersion,updatedAt",
    )
    .single();
  if (updateError) {
    throw new GatewayError(503, "DATABASE_ERROR", updateError.message);
  }

  if (update.role) {
    await audit({
      userId: actor.id,
      action: "role_change",
      resourceId: target.id,
      metadata: {
        targetEmail: target.email,
        previousRole: target.role,
        newRole: update.role,
        reason,
        targetMustReauthenticate: true,
      },
    });
  }
  if (update.status || update.isActive !== undefined) {
    await audit({
      userId: actor.id,
      action: "admin_action",
      resourceId: target.id,
      metadata: {
        targetEmail: target.email,
        previousStatus: target.status,
        newStatus: update.status,
        previousIsActive: target.isActive,
        newIsActive: update.isActive,
        reason,
        targetMustReauthenticate: true,
      },
    });
  }

  return {
    ok: true,
    user: data,
    reauthenticationRequired: true,
  };
}

function iso(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function policyView(policy: Record<string, unknown>) {
  return {
    id: policy.id,
    documentType: policy.document_type,
    version: policy.version,
    policyName: policy.policy_name,
    purpose: policy.purpose,
    retentionDays: policy.retention_days,
    legalBasis: policy.legal_basis,
    jurisdiction: policy.jurisdiction,
    status: policy.status,
    isActive: policy.is_active,
    createdByUserId: policy.created_by_user_id,
    approvedByUserId: policy.approved_by_user_id,
    approvedAt: iso(policy.approved_at),
    rejectedByUserId: policy.rejected_by_user_id,
    rejectedAt: iso(policy.rejected_at),
    rejectionReason: policy.rejection_reason,
    effectiveAt: iso(policy.effective_at),
    supersededAt: iso(policy.superseded_at),
    reviewDueAt: iso(policy.review_due_at),
    createdAt: iso(policy.created_at),
    updatedAt: iso(policy.updated_at),
  };
}

function rpcFailure(
  error: { message?: string } | null,
  fallbackCode: string,
): never {
  const message = error?.message ?? "Retention operation failed";
  const match = message.match(/^([A-Z0-9_]+):(.*)$/s);
  const code = match?.[1] ?? fallbackCode;
  const detail = match?.[2]?.trim() || "Retention operation failed";
  const status =
    code === "FORBIDDEN" || code.endsWith("ROLE_REQUIRED")
      ? 403
      : code === "NOT_FOUND"
        ? 404
        : code.includes("INVALID") ||
            code === "UNKNOWN_ACTION" ||
            code === "REASON_REQUIRED"
          ? 400
          : code.includes("SEPARATION") || code.includes("STATE")
            ? 409
            : 503;
  throw new GatewayError(status, code, detail);
}

async function listRetentionPolicies(actor: { role: string }) {
  const { data, error } = await db
    .from("gem_verify_retention_policies")
    .select(
      "id,document_type,version,policy_name,purpose,retention_days,legal_basis,jurisdiction,status,is_active,created_by_user_id,approved_by_user_id,approved_at,rejected_by_user_id,rejected_at,rejection_reason,effective_at,superseded_at,review_due_at,created_at,updated_at",
    )
    .order("document_type", { ascending: true })
    .order("version", { ascending: false });
  if (error) {
    throw new GatewayError(
      503,
      "RETENTION_POLICY_LIST_UNAVAILABLE",
      error.message,
    );
  }
  return {
    ok: true,
    viewerRole: actor.role,
    policies: (data ?? []).map((policy) =>
      policyView(policy as Record<string, unknown>),
    ),
    governance: {
      versioned: true,
      independentApprovalRequired: true,
      operationalActivationRequired: true,
      automaticDeletionEnabled: false,
    },
  };
}

async function createRetentionPolicy(
  actor: { id: string },
  body: Record<string, unknown>,
) {
  const documentType =
    typeof body.documentType === "string" ? body.documentType.trim() : "";
  const policyName =
    typeof body.policyName === "string" ? body.policyName.trim() : "";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  const retentionDays =
    typeof body.retentionDays === "number" ? body.retentionDays : Number.NaN;
  const legalBasis =
    typeof body.legalBasis === "string" ? body.legalBasis.trim() : "";
  const jurisdiction =
    typeof body.jurisdiction === "string" ? body.jurisdiction.trim() : null;
  const reviewDueAt =
    typeof body.reviewDueAt === "string" ? body.reviewDueAt : null;
  if (
    !documentType ||
    !policyName ||
    !purpose ||
    !legalBasis ||
    !Number.isInteger(retentionDays)
  ) {
    throw new GatewayError(
      400,
      "INVALID_POLICY_DRAFT",
      "Retention policy draft is invalid",
    );
  }
  const { data, error } = await db.rpc("gem_verify_create_retention_policy", {
    p_actor_user_id: actor.id,
    p_document_type: documentType,
    p_policy_name: policyName,
    p_purpose: purpose,
    p_retention_days: retentionDays,
    p_legal_basis: legalBasis,
    p_jurisdiction: jurisdiction,
    p_review_due_at: reviewDueAt,
  });
  if (error) rpcFailure(error, "RETENTION_POLICY_CREATE_UNAVAILABLE");
  const result = data as Record<string, unknown>;
  return {
    ok: true,
    policy: policyView((result.policy ?? {}) as Record<string, unknown>),
    activated: false,
    nextAction: "submit_for_independent_approval",
  };
}

async function actOnRetentionPolicy(
  actor: { id: string },
  body: Record<string, unknown>,
) {
  const policyId = typeof body.policyId === "string" ? body.policyId : "";
  const policyAction =
    typeof body.policyAction === "string" ? body.policyAction : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : null;
  if (
    !policyId ||
    !["submit", "approve", "reject", "deactivate"].includes(policyAction)
  ) {
    throw new GatewayError(
      400,
      "UNKNOWN_ACTION",
      "Retention policy action is invalid",
    );
  }
  const { data, error } = await db.rpc("gem_verify_retention_policy_action", {
    p_actor_user_id: actor.id,
    p_policy_id: policyId,
    p_action: policyAction,
    p_reason: reason,
  });
  if (error) rpcFailure(error, "RETENTION_POLICY_ACTION_UNAVAILABLE");
  return { ok: true, ...(data as Record<string, unknown>) };
}

type CredentialRecord = {
  id: string;
  label: string;
  status: string;
  actor_user_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_used_at: string | null;
};

function requiredText(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
) {
  if (typeof value !== "string") {
    throw new GatewayError(400, "INVALID_REQUEST", `${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new GatewayError(400, "INVALID_REQUEST", `${field} is invalid`);
  }
  return normalized;
}

function requiredDigest(value: unknown) {
  const digest = requiredText(value, "tokenHash", 64, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new GatewayError(400, "INVALID_DIGEST", "Credential digest is invalid");
  }
  return digest;
}

function requireSuperAdmin(actor: { role: string }) {
  if (actor.role !== "super_admin") {
    throw new GatewayError(
      403,
      "SUPER_ADMIN_REQUIRED",
      "Super administrator access is required",
    );
  }
}

function credentialView(record: CredentialRecord) {
  return {
    id: record.id,
    label: record.label,
    status: record.status,
    actorUserId: record.actor_user_id,
    workspaceId: record.workspace_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    expiresAt: record.expires_at,
    lastUsedAt: record.last_used_at,
  };
}

async function requireTokMetricWorkspace() {
  const { data, error } = await db
    .from("tokmetric_workspaces")
    .select(
      "id,name,slug,globalEmergencyLock,publishingDisabled,advertisingDisabled,shopWriteDisabled,connectorDisabled",
    )
    .eq("id", TOKMETRIC_WORKSPACE_ID)
    .maybeSingle();
  if (error) {
    throw new GatewayError(503, "DATABASE_ERROR", "Workspace lookup failed");
  }
  if (!data) {
    throw new GatewayError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  return data;
}

async function credentialAudit(
  actor: { id: string },
  action: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const results = await Promise.allSettled([
    db.from("audit_logs").insert({
      id: crypto.randomUUID(),
      userId: actor.id,
      action: "admin_action",
      resource: "tokmetric_gpt_credential",
      resourceId,
      metadata,
      createdAt: now,
    }),
    db.from("tokmetric_audit_events").insert({
      id: `audit_${crypto.randomUUID().replaceAll("-", "")}`,
      workspaceId: TOKMETRIC_WORKSPACE_ID,
      actorId: actor.id,
      action,
      entityType: "gpt_credential",
      entityId: resourceId,
      correlationId: crypto.randomUUID(),
      outcome: "success",
      sourceChannel: "command_center",
      safeMetadata: metadata,
      createdAt: now,
    }),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("tokmetric_credential_audit_failed");
    }
  }
}

async function listTokMetricCredentials(actor: { id: string; role: string }) {
  requireSuperAdmin(actor);
  const workspace = await requireTokMetricWorkspace();
  const { data, error } = await db
    .from("tokmetric_gpt_credentials")
    .select(
      "id,label,status,actor_user_id,workspace_id,created_at,updated_at,expires_at,last_used_at",
    )
    .eq("workspace_id", TOKMETRIC_WORKSPACE_ID)
    .order("created_at", { ascending: false });
  if (error) {
    throw new GatewayError(503, "DATABASE_ERROR", "Credential list failed");
  }
  return {
    ok: true,
    viewer: { id: actor.id, role: actor.role },
    workspace,
    credentials: ((data ?? []) as CredentialRecord[]).map(credentialView),
  };
}

async function issueTokMetricCredentialDigest(
  actor: { id: string; role: string },
  body: Record<string, unknown>,
) {
  requireSuperAdmin(actor);
  const tokenHash = requiredDigest(body.tokenHash);
  const label = requiredText(body.label, "label", 3, 120);
  const reason = requiredText(body.reason, "reason", 10, 500);
  const confirmation = requiredText(
    body.confirmWorkspaceId,
    "confirmWorkspaceId",
    3,
    200,
  );
  const expiresInDays =
    typeof body.expiresInDays === "number" ? body.expiresInDays : 90;

  if (confirmation !== TOKMETRIC_WORKSPACE_ID) {
    throw new GatewayError(
      400,
      "WORKSPACE_CONFIRMATION_MISMATCH",
      "Workspace confirmation does not match",
    );
  }
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > 365
  ) {
    throw new GatewayError(
      400,
      "INVALID_EXPIRY",
      "Credential expiry must be between 1 and 365 days",
    );
  }

  const workspace = await requireTokMetricWorkspace();
  const { count, error: countError } = await db
    .from("tokmetric_gpt_credentials")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", TOKMETRIC_WORKSPACE_ID)
    .eq("status", "active");
  if (countError) {
    throw new GatewayError(503, "DATABASE_ERROR", "Capacity check failed");
  }
  if ((count ?? 0) >= MAX_ACTIVE_TOKMETRIC_CREDENTIALS) {
    throw new GatewayError(
      409,
      "ACTIVE_CREDENTIAL_LIMIT_REACHED",
      "Revoke an unused credential before issuing another",
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const credentialId = `gptcred_${crypto.randomUUID().replaceAll("-", "")}`;
  const { data, error } = await db
    .from("tokmetric_gpt_credentials")
    .insert({
      id: credentialId,
      token_hash: tokenHash,
      actor_user_id: actor.id,
      workspace_id: TOKMETRIC_WORKSPACE_ID,
      label,
      status: "active",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt,
      last_used_at: null,
    })
    .select(
      "id,label,status,actor_user_id,workspace_id,created_at,updated_at,expires_at,last_used_at",
    )
    .single();
  if (error || !data) {
    throw new GatewayError(503, "CREDENTIAL_ISSUE_FAILED", "Issuance failed");
  }

  await credentialAudit(
    actor,
    "tokmetric.gpt_credential.issued",
    credentialId,
    {
      label,
      reason,
      expiresAt,
      workspaceName: workspace.name,
      readableValueReceived: false,
      digestOnly: true,
    },
  );
  return { ok: true, credential: credentialView(data as CredentialRecord) };
}

async function revokeTokMetricCredential(
  actor: { id: string; role: string },
  body: Record<string, unknown>,
) {
  requireSuperAdmin(actor);
  const credentialId = requiredText(
    body.credentialId,
    "credentialId",
    3,
    200,
  );
  const confirmLabel = requiredText(body.confirmLabel, "confirmLabel", 3, 120);
  const reason = requiredText(body.reason, "reason", 10, 500);
  await requireTokMetricWorkspace();

  const { data: existing, error: lookupError } = await db
    .from("tokmetric_gpt_credentials")
    .select(
      "id,label,status,actor_user_id,workspace_id,created_at,updated_at,expires_at,last_used_at",
    )
    .eq("id", credentialId)
    .eq("workspace_id", TOKMETRIC_WORKSPACE_ID)
    .maybeSingle();
  if (lookupError) {
    throw new GatewayError(503, "DATABASE_ERROR", "Credential lookup failed");
  }
  if (!existing) {
    throw new GatewayError(404, "CREDENTIAL_NOT_FOUND", "Credential not found");
  }
  if (existing.label !== confirmLabel) {
    throw new GatewayError(
      400,
      "CREDENTIAL_CONFIRMATION_MISMATCH",
      "Credential label confirmation does not match",
    );
  }
  if (existing.status === "revoked") {
    throw new GatewayError(
      409,
      "CREDENTIAL_ALREADY_REVOKED",
      "Credential is already revoked",
    );
  }

  const { data, error } = await db
    .from("tokmetric_gpt_credentials")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", credentialId)
    .select(
      "id,label,status,actor_user_id,workspace_id,created_at,updated_at,expires_at,last_used_at",
    )
    .single();
  if (error || !data) {
    throw new GatewayError(503, "CREDENTIAL_REVOKE_FAILED", "Revocation failed");
  }

  await credentialAudit(
    actor,
    "tokmetric.gpt_credential.revoked",
    credentialId,
    { label: existing.label, reason },
  );
  return { ok: true, credential: credentialView(data as CredentialRecord) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const actor = await requireAdmin(body.token);
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "update_user") return json(await updateUser(actor, body));
    if (action === "retention_policy_list") {
      return json(await listRetentionPolicies(actor));
    }
    if (action === "retention_policy_create") {
      return json(await createRetentionPolicy(actor, body), 201);
    }
    if (action === "retention_policy_action") {
      return json(await actOnRetentionPolicy(actor, body));
    }
    if (action === "tokmetric_credential_list") {
      return json(await listTokMetricCredentials(actor));
    }
    if (action === "tokmetric_credential_issue_hash") {
      return json(await issueTokMetricCredentialDigest(actor, body), 201);
    }
    if (action === "tokmetric_credential_revoke") {
      return json(await revokeTokMetricCredential(actor, body));
    }
    if (action === "tokmetric_command") {
      try {
        const result = await dispatchTokMetricCommand({
          db,
          actor,
          workspaceId: TOKMETRIC_WORKSPACE_ID,
          body,
        });
        const created =
          body.operation === "create_draft" ||
          body.operation === "request_approval";
        return json(result, created ? 201 : 200);
      } catch (error) {
        if (error instanceof TokMetricCommandError) {
          throw new GatewayError(error.status, error.code, error.message);
        }
        throw error;
      }
    }
    throw new GatewayError(400, "UNKNOWN_ACTION", "Unknown action");
  } catch (error) {
    if (error instanceof GatewayError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error(
      "gem_admin_write_internal_error",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ error: "Internal gateway error", code: "INTERNAL_ERROR" }, 500);
  }
});
