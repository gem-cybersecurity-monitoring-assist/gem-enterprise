import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  inspectServiceRequestContent,
  serviceRequestPriorityIds,
  serviceRequestTypeCatalog,
} from "@/lib/serviceRequestCatalog";

const source = (path: string) => readFileSync(path, "utf8");

const apiSource = source("src/app/api/requests/route.ts");
const domainSource = source("src/lib/serviceRequests.ts");
const scopeSource = source("src/lib/serviceRequestScope.ts");
const catalogSource = source("src/lib/serviceRequestCatalog.ts");
const pageSource = source("src/app/app/requests/page.tsx");
const migrationSource = source(
  "prisma/migrations/20260714053000_scoped_service_requests/migration.sql",
);
const promotionSource = source("scripts/apply-service-request-prisma.mjs");

describe("secure scoped service requests", () => {
  it("uses a fixed request catalog and excludes emergency priority claims", () => {
    expect(serviceRequestTypeCatalog).toHaveLength(6);
    expect(serviceRequestTypeCatalog.map((item) => item.id)).toEqual([
      "portfolio_review",
      "compliance_review",
      "cyber_briefing",
      "real_estate_trust",
      "document_request",
      "support",
    ]);
    expect(serviceRequestPriorityIds).toEqual(["low", "medium", "high"]);
    expect(serviceRequestPriorityIds).not.toContain("critical");
    expect(pageSource).toContain("not an emergency response commitment");
    expect(pageSource).toContain("No response time is guaranteed by this form");
  });

  it("rejects likely secrets and regulated identifiers without blocking ordinary help language", () => {
    expect(inspectServiceRequestContent("I need help resetting my password.").safe).toBe(true);
    expect(inspectServiceRequestContent("My password is ExampleSecret123!").categories).toContain(
      "credential",
    );
    expect(
      inspectServiceRequestContent(
        "-----BEGIN PRIVATE KEY-----\nTEST-ONLY-NOT-A-REAL-KEY\n-----END PRIVATE KEY-----",
      ).categories,
    ).toContain("private_key");
    expect(
      inspectServiceRequestContent(
        "My recovery phrase is one two three four five six seven eight",
      ).categories,
    ).toContain("recovery_material");
    expect(inspectServiceRequestContent("Card: 4111 1111 1111 1111").categories).toContain(
      "payment_card",
    );
    expect(inspectServiceRequestContent("My routing number is 123456789").categories).toContain(
      "banking_identifier",
    );
    expect(inspectServiceRequestContent("My passport number is A12345678").categories).toContain(
      "identity_identifier",
    );
  });

  it("keeps the browser-safe policy isolated from Prisma", () => {
    expect(catalogSource).not.toContain('from "@/lib/db"');
    expect(catalogSource).not.toContain("Prisma");
    expect(pageSource).toContain('from "@/lib/serviceRequestCatalog"');
    expect(pageSource).not.toContain('from "@/lib/serviceRequests"');
  });

  it("uses authoritative active-account authentication for reads and writes", () => {
    expect(apiSource.match(/requireSession\(\)/g)?.length).toBe(2);
    expect(apiSource.match(/gate\.accountStatus !== "active"/g)?.length).toBe(2);
    expect(apiSource).not.toContain("getSession");
    expect(apiSource).toContain('"Cache-Control": "no-store"');
    expect(apiSource).toContain('"Referrer-Policy": "no-referrer"');
  });

  it("requires explicit same-origin and rate-limited submissions", () => {
    expect(apiSource).toContain('request.headers.get("origin")');
    expect(apiSource).toContain("ORIGIN_REQUIRED");
    expect(apiSource).toContain("request.nextUrl.origin");
    expect(apiSource).toContain("SAME_ORIGIN_REQUIRED");
    expect(apiSource).toContain('key: "service-requests:create"');
    expect(apiSource).toContain("rateLimitedResponse");
  });

  it("keeps personal scope explicit and revalidates workspace membership server-side", () => {
    expect(domainSource).toContain("listAccessibleWorkspaces(normalizedUserId)");
    expect(domainSource).toContain("resolveServiceRequestScope(accessibleWorkspaces");
    expect(scopeSource).toContain(
      "accessibleWorkspaces.find((candidate) => candidate.id === normalizedWorkspaceId)",
    );
    expect(domainSource).toContain("tx.workspaceMember.findFirst");
    expect(domainSource).toContain('status: "active"');
    expect(domainSource).toContain("WORKSPACE_ACCESS_DENIED");
    expect(domainSource).toContain("workspaceId: selectedWorkspace?.id ?? null");
    expect(domainSource).not.toContain("db.workspace.findUnique");
    expect(domainSource).not.toContain("db.workspace.findFirst");
    expect(pageSource).toContain('value="personal"');
    expect(pageSource).toContain("This request will remain personal to your account");
  });

  it("always preserves user ownership on request reads", () => {
    expect(domainSource).toContain("userId: normalizedUserId");
    expect(domainSource).toContain("workspaceId: selectedWorkspace?.id ?? null");
    expect(domainSource).not.toContain("serviceRequest.findMany({\n    where: {\n      workspaceId:");
  });

  it("creates membership check, request, and audit evidence in one serializable transaction", () => {
    expect(domainSource).toContain("db.$transaction(");
    expect(domainSource).toContain("tx.workspaceMember.findFirst");
    expect(domainSource).toContain("tx.serviceRequest.create");
    expect(domainSource).toContain("tx.auditLog.create");
    expect(domainSource).toContain('isolationLevel: "Serializable"');
    expect(domainSource).toContain('code?: unknown }).code === "P2034"');
    expect(domainSource).toContain("REQUEST_CONFLICT");
    expect(domainSource).toContain('action: "case_created"');
    expect(domainSource).toContain('resource: "service_request"');
    expect(domainSource).toContain("ipAddress: input.ipAddress");
    expect(domainSource).toContain("userAgent: input.userAgent");
    expect(apiSource).not.toContain("emitAuditLog");
  });

  it("shows real load and submission failures in the client", () => {
    expect(pageSource).toContain("Service requests could not be loaded");
    expect(pageSource).toContain("The request was not submitted");
    expect(pageSource).toContain('aria-live="polite"');
    expect(pageSource).toContain("setError(data.error");
    expect(pageSource).toContain("setSuccess(");
  });

  it("uses an additive nullable migration without historical backfill or scope erasure", () => {
    expect(migrationSource).toContain('ADD COLUMN "workspaceId" TEXT');
    expect(migrationSource).toContain('CREATE INDEX "requests_workspaceId_createdAt_idx"');
    expect(migrationSource).toContain('REFERENCES public."tokmetric_workspaces"("id")');
    expect(migrationSource).toContain("ON DELETE RESTRICT");
    expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migrationSource).not.toContain("ON DELETE SET NULL");
    expect(migrationSource).not.toContain("UPDATE public");
    expect(migrationSource).not.toContain("NOT NULL");
  });

  it("promotes the Prisma relation idempotently for every build workflow", () => {
    expect(promotionSource).toContain("serviceRequests             ServiceRequest[]");
    expect(promotionSource).toContain("workspaceId String?");
    expect(promotionSource).toContain("onDelete: Restrict");
    expect(promotionSource).not.toContain("onDelete: SetNull");
    expect(promotionSource).toContain("@@index([workspaceId, createdAt])");
    expect(promotionSource).toContain("result.changed");
  });
});
