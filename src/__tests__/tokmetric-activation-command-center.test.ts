import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("TokMetric activation command center", () => {
  it("retains the approved administrator gateway and TokMetric module", () => {
    const ignore = source(".vercelignore");
    expect(ignore).toContain("!supabase/functions/gem-admin-write/");
    expect(ignore).toContain("!supabase/functions/gem-admin-write/index.ts");
    expect(ignore).toContain(
      "!supabase/functions/gem-admin-write/tokmetric-command.ts",
    );
  });

  it("requires a versioned GEM administrator session", () => {
    const gateway = source("supabase/functions/gem-admin-write/index.ts");
    expect(gateway).toContain("sessionVersion");
    expect(gateway).toContain('"SESSION_REVOKED"');
    expect(gateway).toContain('payload.iss !== "gem-auth-gateway"');
    expect(gateway).toContain('payload.aud !== "gem-enterprise"');
    expect(gateway).toContain("ADMIN_ROLES.includes");
  });

  it("keeps activation operations internal and fail closed", () => {
    const command = source(
      "supabase/functions/gem-admin-write/tokmetric-command.ts",
    );
    expect(command).toContain('controlledWriteMode: "COMMAND_CENTER_ONLY"');
    expect(command).toContain("externalActionTaken: false");
    expect(command).toContain('"LIVE_PUBLISHING_GATE_DISABLED"');
    expect(command).not.toContain("PUBLISHED_CONFIRMED");
    expect(command).not.toContain("open.tiktokapis.com");
  });

  it("supports the complete controlled activation sequence", () => {
    const command = source(
      "supabase/functions/gem-admin-write/tokmetric-command.ts",
    );
    for (const operation of [
      "snapshot",
      "create_draft",
      "create_version",
      "run_review",
      "request_approval",
      "decide_approval",
      "publish_preflight",
    ]) {
      expect(command).toContain(`operation === "${operation}"`);
    }
    const gateway = source("supabase/functions/gem-admin-write/index.ts");
    expect(gateway).toContain('action === "tokmetric_command"');
    expect(gateway).toContain("dispatchTokMetricCommand");
  });

  it("proxies commands only through the HttpOnly GEM session", () => {
    const route = source("src/app/api/tokmetric/command/route.ts");
    const client = source("src/lib/tokmetric/command-gateway.ts");
    expect(route).toContain("getGatewaySessionToken");
    expect(route).toContain("GEM_SESSION_REQUIRED");
    expect(route).toContain("invokeTokMetricCommandGateway");
    expect(route).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(client).toContain("adminWriteGateway");
    expect(client).toContain('"tokmetric_command"');
    expect(client).not.toContain("DEFAULT_COMMAND_GATEWAY_URL");
    expect(client).not.toContain("GEM_SUPABASE_GATEWAY_ANON_KEY");
    expect(route).not.toContain("POSTGRES_PRISMA_URL");
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("preserves existing administrator, retention, and credential actions", () => {
    const gateway = source("supabase/functions/gem-admin-write/index.ts");
    for (const action of [
      "update_user",
      "retention_policy_list",
      "retention_policy_create",
      "retention_policy_action",
      "tokmetric_credential_list",
      "tokmetric_credential_issue_hash",
      "tokmetric_credential_revoke",
    ]) {
      expect(gateway).toContain(`action === "${action}"`);
    }
  });

  it("exposes real operator controls in the protected command center", () => {
    const panel = source(
      "src/components/tokmetric/TokMetricActivationPanel.tsx",
    );
    const page = source("src/app/app/command-center/tokmetric/page.tsx");
    expect(panel).toContain('fetch("/api/tokmetric/command"');
    expect(panel).toContain("Connect Login Kit");
    expect(panel).toContain("Connect Posting API");
    expect(panel).toContain("Create internal content draft");
    expect(panel).toContain("Run review");
    expect(panel).toContain("Request approval");
    expect(panel).toContain("Preflight");
    expect(panel).toContain("External actions taken: none");
    expect(page).toContain("<TokMetricActivationPanel />");
  });
});
