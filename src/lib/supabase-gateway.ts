import bcrypt from "bcryptjs";
import type { SessionPayload } from "@/lib/auth";

const DEFAULT_GATEWAY_BASE_URL =
  "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1";
const DEFAULT_GATEWAY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsemRqb3FwemJrd3p1YWV4bGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTk1MTQsImV4cCI6MjA5ODg3NTUxNH0.0wfgX_m6SBn_TtD0ZNjkOZ-bk8Frp2Tq1HL9mYFBm4M";
const GATEWAY_COOKIE_PREFIX = "sg1.";
const REQUEST_TIMEOUT_MS = 60_000;

export class GatewayRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GatewayRequestError";
  }
}

interface GatewayErrorBody {
  error?: string;
  code?: string;
}

interface GatewayLoginResponse {
  token: string;
  session: SessionPayload;
  expiresIn: number;
}

function gatewayBaseUrl(): string {
  return (
    process.env.GEM_SUPABASE_GATEWAY_BASE_URL?.trim() ||
    DEFAULT_GATEWAY_BASE_URL
  ).replace(/\/$/, "");
}

function gatewayAnonKey(): string {
  return (
    process.env.GEM_SUPABASE_GATEWAY_ANON_KEY?.trim() ||
    DEFAULT_GATEWAY_ANON_KEY
  );
}

function gatewayProjectUrl(): string {
  const baseUrl = gatewayBaseUrl();
  const functionsSuffix = "/functions/v1";
  if (baseUrl.endsWith(functionsSuffix)) {
    return baseUrl.slice(0, -functionsSuffix.length);
  }
  return new URL(baseUrl).origin;
}

export function hasDirectDatabaseConfiguration(): boolean {
  return Boolean(
    process.env.POSTGRES_PRISMA_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim() ||
      process.env.NEON_DATABASE_URL?.trim(),
  );
}

export function shouldUseSupabaseGateway(): boolean {
  if (process.env.GEM_AUTH_GATEWAY_ENABLED === "false") return false;
  if (process.env.GEM_AUTH_GATEWAY_ENABLED === "true") return true;
  return !hasDirectDatabaseConfiguration();
}

async function invokeGateway<T>(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const key = gatewayAnonKey();
    const response = await fetch(`${gatewayBaseUrl()}/${functionName}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as
      | T
      | GatewayErrorBody;

    if (!response.ok) {
      const errorBody = body as GatewayErrorBody;
      throw new GatewayRequestError(
        response.status,
        errorBody.code || "GATEWAY_REQUEST_FAILED",
        errorBody.error || "Gateway request failed.",
      );
    }

    return body as T;
  } catch (error) {
    if (error instanceof GatewayRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayRequestError(
        504,
        "GATEWAY_TIMEOUT",
        "Supabase gateway timed out.",
      );
    }
    throw new GatewayRequestError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Supabase gateway is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type NewsGatewayAction = "feed" | "story" | "status";

/** Public, read-only native news gateway. Mutating ingestion is never exposed here. */
export async function newsGateway<T>(
  action: NewsGatewayAction,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return invokeGateway<T>("gem-news-gateway", { action, ...payload });
}

export async function evidenceGatewayHealth<T = {
  ok: boolean;
  service: string;
  version: string;
  failClosed: boolean;
}>(): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const key = gatewayAnonKey();
    const response = await fetch(
      `${gatewayBaseUrl()}/gem-verify-evidence-gateway`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const body = (await response.json().catch(() => ({}))) as T | GatewayErrorBody;
    if (!response.ok) {
      const errorBody = body as GatewayErrorBody;
      throw new GatewayRequestError(
        response.status,
        errorBody.code || "EVIDENCE_GATEWAY_UNAVAILABLE",
        errorBody.error || "Evidence gateway is unavailable.",
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof GatewayRequestError) throw error;
    throw new GatewayRequestError(
      503,
      "EVIDENCE_GATEWAY_UNAVAILABLE",
      "Evidence gateway is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function wrapGatewayToken(token: string): string {
  return `${GATEWAY_COOKIE_PREFIX}${token}`;
}

export function isWrappedGatewayToken(value: string): boolean {
  return value.startsWith(GATEWAY_COOKIE_PREFIX);
}

export function unwrapGatewayToken(value: string): string | null {
  if (!isWrappedGatewayToken(value)) return null;
  const token = value.slice(GATEWAY_COOKIE_PREFIX.length);
  return token.length > 20 ? token : null;
}

export async function loginWithGateway(
  email: string,
  password: string,
): Promise<GatewayLoginResponse> {
  return invokeGateway<GatewayLoginResponse>("gem-auth-gateway", {
    action: "login",
    email,
    password,
  });
}

export async function verifyGatewaySession(
  token: string,
): Promise<SessionPayload> {
  const response = await invokeGateway<{ session: SessionPayload }>(
    "gem-auth-gateway",
    { action: "verify", token },
  );
  return { ...response.session, authSource: "supabase_gateway" };
}

export async function bootstrapGatewayStatus<T>(): Promise<T> {
  return invokeGateway<T>("gem-auth-gateway", {
    action: "bootstrap_status",
  });
}

export type WorkspaceGatewayAction =
  | "access"
  | "overview"
  | "admin_snapshot"
  | "provision"
  | "ai_session"
  | "ai_message_event"
  | "support_session"
  | "create_project"
  | "add_member"
  | "create_update"
  | "review_update";

export async function workspaceGateway<T>(
  action: WorkspaceGatewayAction,
  token: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return invokeGateway<T>("gem-workspace-gateway", { action, token, ...payload });
}

export type AdminReadGatewayAction =
  | "users"
  | "stats"
  | "pilot_readiness"
  | "audit"
  | "retention_dry_run"
  | "deletion_requests";

export async function adminReadGateway<T>(
  action: AdminReadGatewayAction,
  token: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return invokeGateway<T>("gem-admin-read", {
    action,
    token,
    ...payload,
  });
}

export type AdminWriteGatewayAction =
  | "update_user"
  | "retention_policy_list"
  | "retention_policy_create"
  | "retention_policy_action";

export async function adminWriteGateway<T>(
  action: AdminWriteGatewayAction,
  token: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return invokeGateway<T>("gem-admin-write", {
    action,
    token,
    ...payload,
  });
}

export type TokMetricCredentialStoreAction =
  | "list"
  | "issue_hash"
  | "revoke";

export async function tokMetricCredentialStoreGateway<T>(
  action: TokMetricCredentialStoreAction,
  token: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return invokeGateway<T>("gem-tokmetric-credential-store", {
    action,
    token,
    ...payload,
  });
}

export type EvidenceGatewayAction =
  | "readiness"
  | "upload_intent"
  | "complete"
  | "items"
  | "review_url"
  | "status"
  | "approve_operations"
  | "activate_uploads"
  | "deactivate_uploads";

export async function evidenceGateway<T>(
  action: EvidenceGatewayAction,
  token: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return invokeGateway<T>("gem-verify-evidence-gateway", {
    action,
    token,
    ...payload,
  });
}

export async function e2eProvisionGateway<T>(
  action: "create" | "cleanup",
  payload: Record<string, unknown>,
): Promise<T> {
  return invokeGateway<T>("gem-e2e-provision", {
    action,
    ...payload,
  });
}

export async function runPendingAdminLoginSmoke<T>(): Promise<T> {
  return invokeGateway<T>("gem-admin-login-smoke", {});
}

export async function setAdminPasswordWithAccessToken<T>(
  accessToken: string,
  password: string,
): Promise<T> {
  const tokenDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken),
  );
  const tokenHash = Array.from(new Uint8Array(tokenDigest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const passwordHash = await bcrypt.hash(password, 12);
  const key = gatewayAnonKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${gatewayProjectUrl()}/rest/v1/rpc/gem_consume_admin_access_token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_token_hash: tokenHash,
          p_password_hash: passwordHash,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const body = (await response.json().catch(() => null)) as
      | Array<{ ok: boolean; user_id: string | null; email: string | null }>
      | { message?: string }
      | null;

    if (!response.ok) {
      throw new GatewayRequestError(
        response.status >= 500 ? 503 : response.status,
        "ADMIN_ACCESS_RPC_FAILED",
        "Administrator setup is unavailable.",
      );
    }

    const result = Array.isArray(body) ? body[0] : null;
    if (!result?.ok || !result.email) {
      throw new GatewayRequestError(
        400,
        "INVALID_TOKEN",
        "Invalid or expired setup capability.",
      );
    }

    return {
      ok: true,
      email: result.email,
      loginPath: "/client-login",
    } as T;
  } catch (error) {
    if (error instanceof GatewayRequestError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayRequestError(
        504,
        "GATEWAY_TIMEOUT",
        "Administrator setup timed out.",
      );
    }
    throw new GatewayRequestError(
      503,
      "GATEWAY_UNAVAILABLE",
      "Administrator setup is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export interface PasswordRecoveryRequestResult {
  accepted: boolean;
  recovery: "email_requested" | "email_not_configured";
  emailDeliveryConfigured: boolean;
}

export async function requestPasswordRecoveryGateway(
  email: string,
): Promise<PasswordRecoveryRequestResult> {
  return invokeGateway<PasswordRecoveryRequestResult>("gem-password-recovery", {
    action: "request",
    email,
  });
}

export interface PasswordRecoveryCompletionResult {
  ok: true;
  userId: string;
}

export async function completePasswordRecoveryGateway(
  token: string,
  newPassword: string,
): Promise<PasswordRecoveryCompletionResult> {
  return invokeGateway<PasswordRecoveryCompletionResult>(
    "gem-password-recovery",
    {
      action: "complete",
      token,
      newPassword,
    },
  );
}
