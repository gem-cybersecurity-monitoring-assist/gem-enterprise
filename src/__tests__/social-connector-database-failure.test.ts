import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/tokmetric/security", () => ({ TokMetricError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } } }));
import { connectorDatabaseFailure } from "@/lib/social-media/database-failure";

describe("social connector database failure", () => {
  it.each(["P1000", "P1001", "P1011", "P2021", "P2022"])("preserves safe diagnostic %s", (code) => {
    const result = connectorDatabaseFailure({ code, message: "postgresql://private:password@database" });
    expect(result.status).toBe(503);
    expect(result.code).toBe(`SOCIAL_CONNECTOR_DATABASE_${code}`);
    expect(result.message).not.toContain("password");
  });
  it.each([
    [{ message: "self-signed certificate in certificate chain postgresql://secret" }, "TLS_CERTIFICATE"],
    [{ message: 'prepared statement "s0" already exists' }, "POOLER_STATEMENT"],
    [{ message: "Tenant or user not found" }, "POOLER_IDENTITY"],
    [{ message: "password authentication failed for user private" }, "AUTHENTICATION"],
    [{ name: "PrismaClientValidationError", message: "private" }, "QUERY_VALIDATION"],
    [{ name: "PrismaClientInitializationError", message: "private" }, "CLIENT_INITIALIZATION"],
    [{ name: "PrismaClientUnknownRequestError", message: "private" }, "UNKNOWN_QUERY"],
  ])("classifies failures without reflecting details", (error, category) => {
    const result = connectorDatabaseFailure(error);
    expect(result.code).toBe(`SOCIAL_CONNECTOR_DATABASE_${category}`);
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("postgresql:");
  });
  it("recognizes Prisma initialization errorCode", () => {
    expect(connectorDatabaseFailure({ errorCode: "P1011" }).code).toBe("SOCIAL_CONNECTOR_DATABASE_P1011");
  });
  it.each([null, "private", { code: "private" }, { message: "private" }])("never reflects arbitrary error details", (error) => {
    const result = connectorDatabaseFailure(error);
    expect(result.code).toBe("SOCIAL_CONNECTOR_DATABASE_UNAVAILABLE");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
