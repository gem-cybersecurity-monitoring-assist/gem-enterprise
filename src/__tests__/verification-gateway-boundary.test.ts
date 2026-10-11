import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routes: Array<[string, number]> = [
  ["src/app/api/verify/applications/route.ts", 2],
  ["src/app/api/verify/applications/consent/route.ts", 1],
  ["src/app/api/verify/applications/submit/route.ts", 1],
  ["src/app/api/admin/kyc/route.ts", 1],
  ["src/app/api/verify/system/route.ts", 1],
  ["src/app/api/kyc/route.ts", 1],
  ["src/app/api/kyc/submit/route.ts", 1],
];

describe("verification gateway consistency", () => {
  it.each(routes)("%s guards every Prisma-backed authenticated handler", (path, expected) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    const gate = 'if (gate.session.authSource === "supabase_gateway") return gatewayVerificationUnavailable();';
    expect(source).toContain('import { gatewayVerificationUnavailable }');
    expect(source.split(gate).length - 1).toBe(expected);
    expect(source.split("if (!gate.ok) return gate.response;").length - 1).toBe(expected);
    const handlers = [...source.matchAll(/export async function (GET|POST)\(/g)].map((m) => m.index ?? 0);
    const expectedHandlers = path.endsWith("/api/admin/kyc/route.ts") || path.endsWith("/api/kyc/route.ts")
      ? handlers.length - 1 : handlers.length;
    expect(expectedHandlers).toBe(expected);
  });

  it("does not change authenticated direct-database behavior in the main review route", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/verify/review/route.ts"), "utf8");
    expect(source.split('gate.session.authSource === "supabase_gateway"').length - 1).toBe(2);
    expect(source).toContain("VERIFICATION_REVIEW_GATEWAY_REQUIRED");
  });

  it("returns a generic 503 response with no-store semantics", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/kyc/gateway-guard.ts"), "utf8");
    expect(source).toContain("VERIFICATION_GATEWAY_BACKEND_REQUIRED");
    expect(source).toContain("status: 503");
    expect(source).toContain("no-store");
  });
});
