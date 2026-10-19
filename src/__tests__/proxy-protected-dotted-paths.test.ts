import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ session: null as null | Record<string, unknown> }));
vi.mock("@/lib/auth", () => ({
  getSessionFromRequest: vi.fn(async () => auth.session),
  resolveAccessDestination: vi.fn(() => "/app/dashboard"),
}));

import { proxy } from "@/proxy";

function get(path: string) {
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers: { host: "localhost:3000" } }));
}

describe("proxy: dotted paths under protected prefixes", () => {
  beforeEach(() => {
    auth.session = null;
  });

  it.each([
    ["/app/portfolios/verify.sample", "/client-login"],
    ["/app/command-center/overview.json", "/admin-login"],
    ["/app/admin/api/governance.v2", "/admin-login"],
    ["/review/queue.csv", "/team-login"],
  ])("redirects anonymous %s to %s instead of skipping auth", async (path, login) => {
    const res = await get(path);
    expect(res.status).toBe(307);
    const target = new URL(res.headers.get("location")!);
    expect(target.pathname).toBe(login);
    expect(target.searchParams.get("next")).toBe(path);
  });

  it("keeps the admin role gate for dotted admin paths", async () => {
    auth.session = { userId: "u1", email: "c@example.com", role: "client", kycStatus: "approved", entitlements: [] };
    const res = await get("/app/admin/users.json");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/dashboard");
  });

  it.each(["/_next/static/chunk.js", "/api/health", "/images/logo.png", "/sitemap.xml", "/robots.txt"])(
    "still passes %s through without a session lookup",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );
});
