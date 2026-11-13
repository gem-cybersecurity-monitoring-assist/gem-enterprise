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
  it("recognizes Prisma initialization errorCode", () => {
    expect(connectorDatabaseFailure({ errorCode: "P1011" }).code).toBe("SOCIAL_CONNECTOR_DATABASE_P1011");
  });
  it.each([null, "private", { code: "private" }, { message: "private" }])("never reflects arbitrary error details", (error) => {
    const result = connectorDatabaseFailure(error);
    expect(result.code).toBe("SOCIAL_CONNECTOR_DATABASE_UNAVAILABLE");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
