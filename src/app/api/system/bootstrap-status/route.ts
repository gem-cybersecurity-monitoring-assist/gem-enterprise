import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import {
  bootstrapGatewayStatus,
  evidenceGatewayHealth,
  hasDirectDatabaseConfiguration,
  shouldUseSupabaseGateway,
} from "@/lib/supabase-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function configuredAny(names: string[]) {
  return names.some(configured);
}

async function collectBootstrapStatus() {
  const appUrlConfigured = configured("NEXT_PUBLIC_APP_URL");
  const databaseUrlConfigured = hasDirectDatabaseConfiguration();
  const directDatabaseUrlExplicitlyConfigured = configuredAny([
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NO_SSL",
  ]);
  const jwtSecretConfigured = (process.env.JWT_SECRET?.trim().length ?? 0) >= 32;
  const passwordResetSecretConfigured =
    (process.env.PASSWORD_RESET_SECRET?.trim().length ?? 0) >= 32 ||
    jwtSecretConfigured;
  const smtpConfigured =
    configured("SMTP_HOST") &&
    configured("SMTP_PORT") &&
    configured("SMTP_USER") &&
    configured("SMTP_PASS") &&
    configuredAny(["EMAIL_FROM", "SMTP_FROM", "MAIL_FROM"]);

  const gatewaySelected = shouldUseSupabaseGateway();
  let gatewayOperational = false;
  let administratorConfigured: boolean | null = null;
  let gatewayDiagnostic = gatewaySelected ? "not_checked" : "not_selected";

  if (gatewaySelected) {
    try {
      const gateway = await bootstrapGatewayStatus<{
        configured: boolean;
        admin: unknown | null;
      }>();
      gatewayOperational = true;
      administratorConfigured = gateway.configured;
      gatewayDiagnostic = "ok";
    } catch {
      gatewayDiagnostic = "unavailable";
    }
  }

  let evidenceGatewayOperational = false;
  let evidenceGatewayDiagnostic = "not_checked";
  try {
    const health = await evidenceGatewayHealth<{
      ok: boolean;
      service: string;
      version: string;
      failClosed: boolean;
    }>();
    evidenceGatewayOperational = health.ok === true;
    evidenceGatewayDiagnostic = evidenceGatewayOperational ? "ok" : "unhealthy";
  } catch {
    evidenceGatewayDiagnostic = "unavailable";
  }

  const localPrismaReady = databaseUrlConfigured && jwtSecretConfigured;
  const coreReady =
    appUrlConfigured && (gatewayOperational || localPrismaReady);
  const activeBackend = gatewayOperational
    ? "supabase_gateway"
    : localPrismaReady
      ? "prisma"
      : "none";

  const missingCore: string[] = [];
  if (!appUrlConfigured) missingCore.push("NEXT_PUBLIC_APP_URL");
  if (!gatewayOperational && !databaseUrlConfigured) {
    missingCore.push("SUPABASE_GATEWAY_OR_POSTGRES_PRISMA_URL");
  }
  if (!gatewayOperational && databaseUrlConfigured && !jwtSecretConfigured) {
    missingCore.push("JWT_SECRET");
  }

  return {
    ok: true,
    service: "gem-enterprise-bootstrap-status",
    evaluatedAt: new Date().toISOString(),
    deployment: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      projectIdMatchesCanonical:
        !process.env.VERCEL_PROJECT_ID ||
        process.env.VERCEL_PROJECT_ID ===
          "prj_VDGqnA7wZt2E65LLvT94ZOpnYc2Z",
    },
    core: {
      ready: coreReady,
      activeBackend,
      gateway: {
        selected: gatewaySelected,
        operational: gatewayOperational,
        diagnostic: gatewayDiagnostic,
        administratorConfigured,
      },
      prisma: {
        databaseUrlConfigured,
        runtimeReady: localPrismaReady,
        directDatabaseUrlExplicitlyConfigured,
        databaseAdministrationReady:
          databaseUrlConfigured && directDatabaseUrlExplicitlyConfigured,
      },
      authenticationConfigured: gatewayOperational || jwtSecretConfigured,
      authenticationSource: gatewayOperational
        ? "supabase_gateway"
        : jwtSecretConfigured
          ? "local_jwt"
          : "missing",
      passwordResetSigningConfigured: passwordResetSecretConfigured,
      appUrlConfigured,
      smtpConfigured,
      missing: missingCore,
    },
    evidenceVault: {
      infrastructureReady: evidenceGatewayOperational,
      backend: "supabase_edge_gateway",
      gateway: {
        operational: evidenceGatewayOperational,
        diagnostic: evidenceGatewayDiagnostic,
        service: "gem-verify-evidence-gateway",
        privateServiceRoleHeldInSupabase: true,
        vercelServiceRoleRequired: false,
        vercelScannerSecretsRequired: false,
      },
      activationReady: false,
      activationState: "requires_authenticated_governance_check",
      controls: [
        "approved_active_retention_policy",
        "operational_approval",
        "different_administrator_upload_activation",
      ],
      uploadsFailClosed: true,
      staleScanScheduler: {
        provider: "supabase_pg_cron",
        expectedIntervalMinutes: 10,
        requiresVercelSecret: false,
      },
    },
    scanner: {
      backend: "supabase_edge_gateway",
      engine: "gem-supabase-static-safety-v1",
      assurance: "structural_file_safety_only",
      antivirusEquivalent: false,
      biometricAnalysis: false,
      syntheticSelfTestEndpoint:
        "https://www.gemcybersecurityassist.com/api/verify/evidence/internal-scanner/self-test",
    },
    safety: {
      secretValuesExposed: false,
      demoDataEnabled: process.env.SEED_DEMO_DATA === "true",
      automaticDatabasePushEnabled: process.env.AUTO_DB_PUSH === "true",
      automaticDatabaseSeedEnabled: process.env.AUTO_DB_SEED === "true",
      automaticMigrationEnabled: process.env.RUN_DB_MIGRATIONS === "true",
    },
  };
}

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Anonymous callers get liveness and overall readiness only. Deployment metadata,
 * backend topology, configuration posture and safety flags require an administrator.
 */
export async function GET() {
  const [gate, status] = await Promise.all([requireAdmin(), collectBootstrapStatus()]);
  if (gate.ok) return NextResponse.json(status, { status: 200, headers });

  return NextResponse.json(
    {
      ok: true,
      service: status.service,
      evaluatedAt: status.evaluatedAt,
      core: { ready: status.core.ready },
      detailsRequireAdministrator: true,
    },
    { status: 200, headers },
  );
}
