import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ query: vi.fn(), gateway: vi.fn(), selected: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: mocks.query } }));
vi.mock("@/lib/supabase-gateway", () => ({
  bootstrapGatewayStatus: mocks.gateway, shouldUseSupabaseGateway: mocks.selected,
}));
import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selected.mockReturnValue(false);
  mocks.query.mockResolvedValue([{ value: 1 }]);
});
afterEach(() => vi.unstubAllEnvs());

describe("health reports configuration rather than untested authentication", () => {
  it("fails readiness for a healthy database with an invalid signing configuration", async () => {
    vi.stubEnv("JWT_SECRET", "");
    const response = await GET(new NextRequest("http://localhost/api/health"));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.services.database).toBe("ok");
    expect(body.services.authentication).toBe("not_configured");
    expect(body.services.authenticationVerified).toBe(false);
  });

  it("does not claim a successful login when configuration and database are healthy", async () => {
    const response = await GET(new NextRequest("http://localhost/api/health"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.services.authentication).toBe("configured");
    expect(body.services.authenticationVerified).toBe(false);
  });

  it("reports database failure independently of signing configuration", async () => {
    mocks.query.mockRejectedValue(new Error("connection refused"));
    const response = await GET(new NextRequest("http://localhost/api/health"));
    expect(response.status).toBe(503);
    expect((await response.json()).services.authentication).toBe("degraded");
  });

  it("supports the selected gateway without requiring a local signing key", async () => {
    vi.stubEnv("JWT_SECRET", "");
    mocks.selected.mockReturnValue(true);
    mocks.gateway.mockResolvedValue({ configured: true });
    const response = await GET(new NextRequest("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect((await response.json()).services.backend).toBe("supabase_gateway");
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
