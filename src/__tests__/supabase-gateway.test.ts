import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminReadGateway,
  GatewayRequestError,
  loginWithGateway,
  runPendingAdminLoginSmoke,
  setAdminPasswordWithAccessToken,
  unwrapGatewayToken,
  wrapGatewayToken,
} from "@/lib/supabase-gateway";

describe("Supabase gateway client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("wraps and unwraps gateway session tokens", () => {
    const token = "a".repeat(64);
    expect(wrapGatewayToken(token)).toBe(`sg1.${token}`);
    expect(unwrapGatewayToken(`sg1.${token}`)).toBe(token);
    expect(unwrapGatewayToken("local.jwt.token")).toBeNull();
  });

  it("sends login to the authentication gateway with Supabase headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "b".repeat(64),
          session: {
            userId: "admin-1",
            email: "admin@example.com",
            role: "admin",
            kycStatus: "not_started",
            entitlements: [],
          },
          expiresIn: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loginWithGateway("admin@example.com", "password");

    expect(result.session.role).toBe("admin");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/gem-auth-gateway"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
          apikey: expect.any(String),
        }),
      }),
    );
  });

  it("forwards read-only admin actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await adminReadGateway("users", "c".repeat(64));

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      action: "users",
      token: "c".repeat(64),
    });
  });

  it("invokes the pending smoke function without a request secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, checks: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await runPendingAdminLoginSmoke();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/gem-admin-login-smoke"),
      expect.objectContaining({
        method: "POST",
        body: "{}",
      }),
    );
  });

  it("sends only token and password hashes to the administrator access RPC", async () => {
    const accessToken = "setup-capability-" + "a".repeat(48);
    const password = "Strong-Administrator-Password-2026!";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            ok: true,
            user_id: "admin-1",
            email: "admin@gemcybersecurityassist.com",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await setAdminPasswordWithAccessToken<{
      ok: boolean;
      email: string;
      loginPath: string;
    }>(accessToken, password);

    expect(result).toEqual({
      ok: true,
      email: "admin@gemcybersecurityassist.com",
      loginPath: "/client-login",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      p_token_hash: string;
      p_password_hash: string;
    };
    expect(url).toContain("/rest/v1/rpc/gem_consume_admin_access_token");
    expect(body.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.p_token_hash).not.toContain(accessToken);
    expect(body.p_password_hash).toMatch(/^\$2[aby]\$/);
    expect(body.p_password_hash).not.toContain(password);
    expect(String(init.body)).not.toContain(accessToken);
    expect(String(init.body)).not.toContain(password);
  });

  it("maps gateway failures to a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      loginWithGateway("admin@example.com", "wrong"),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<GatewayRequestError>);
  });

  it("normalizes object-shaped gateway failures before they reach the UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "AUTH_GATEWAY_REJECTED",
              message: "Authentication could not be completed.",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      loginWithGateway("admin@example.com", "password"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "AUTH_GATEWAY_REJECTED",
      message: "Authentication could not be completed.",
    } satisfies Partial<GatewayRequestError>);
  });
});
