import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("TokMetric activation approval safety", () => {
  const command = source(
    "supabase/functions/gem-admin-write/tokmetric-command.ts",
  );
  const gateway = source("supabase/functions/gem-admin-write/index.ts");

  it("requires an explicit operation at application and gateway layers", () => {
    const route = source("src/app/api/tokmetric/command/route.ts");
    expect(route).toContain("TokMetric command operation is required.");
    expect(command).toContain(
      'requiredText(input.body.operation, "operation", 3, 100)',
    );
    expect(command).toContain('"INVALID_OPERATION"');
    expect(gateway).toContain('action === "tokmetric_command"');
  });

  it("requires compliance evidence before approval", () => {
    expect(command).toContain('"COMPLIANCE_REVIEW_REQUIRED"');
    expect(command).toContain('["PASS", "HUMAN_REVIEW_REQUIRED"]');
    expect(command).toContain('"COMPLIANCE_BLOCKED"');
  });

  it("prevents self-approval and enforces the requested role", () => {
    expect(command).toContain("approval.requestedById === actor.id");
    expect(command).toContain('"APPROVAL_SEPARATION_REQUIRED"');
    expect(command).toContain("roleCanDecide(actor.role, approval.requiredRole)");
    expect(command).toContain('"APPROVER_ROLE_REQUIRED"');
  });

  it("binds approval to the current exact version and object hash", () => {
    expect(command).toContain(
      "content.currentVersionId !== approval.contentVersionId",
    );
    expect(command).toContain("version.objectHash !== approval.objectHash");
    expect(command).toContain('"APPROVAL_VERSION_MISMATCH"');
    expect(command).toContain('"APPROVAL_HASH_MISMATCH"');
  });

  it("requires a connected posting connector and authorized publishing scope", () => {
    expect(command).toContain('"TIKTOK_CONTENT_POSTING_API"');
    expect(command).toContain('scopes.has("video.publish")');
    expect(command).toContain('scopes.has("video.upload")');
    expect(command).toContain('"CONTENT_POSTING_SCOPE_NOT_AUTHORIZED"');
    expect(command).toContain('"LIVE_PUBLISHING_GATE_DISABLED"');
  });

  it("enforces session revocation for every administrator command", () => {
    expect(gateway).toContain("validSessionVersion(sessionVersion)");
    expect(gateway).toContain("user.sessionVersion !== sessionVersion");
    expect(gateway).toContain('"SESSION_REVOKED"');
  });

  it("never performs an external TikTok write", () => {
    expect(command).toContain("externalActionTaken: false");
    expect(command).not.toContain("open.tiktokapis.com");
    expect(gateway).not.toContain("open.tiktokapis.com");
  });
});
