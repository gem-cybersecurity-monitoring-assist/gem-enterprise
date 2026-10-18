import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const gatewayMocks = vi.hoisted(() => ({
  login: vi.fn(),
  shouldUse: vi.fn(),
  wrap: vi.fn((token: string) => `sg1.${token}`),
}));

const contactGatewayMocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  supportBookingCreate: vi.fn(),
  supportBookingUpdate: vi.fn(),
  supportTicketCreate: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase-gateway", () => {
  class GatewayRequestError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    GatewayRequestError,
    loginWithGateway: gatewayMocks.login,
    shouldUseSupabaseGateway: gatewayMocks.shouldUse,
    wrapGatewayToken: gatewayMocks.wrap,
  };
});

vi.mock("@/lib/contact-gateway", () => ({
  submitContactGateway: contactGatewayMocks.submit,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: dbMocks.userFindUnique,
      update: dbMocks.userUpdate,
    },
    supportBooking: {
      create: dbMocks.supportBookingCreate,
      update: dbMocks.supportBookingUpdate,
    },
    supportTicket: {
      create: dbMocks.supportTicketCreate,
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  signSession: vi.fn(),
  getSession: authMocks.getSession,
  resolveAccessDestination: vi.fn(() => "/app/admin"),
  setSessionCookie: (response: NextResponse, token: string) => {
    response.headers.set("x-test-session-token", token);
    return response;
  },
}));

vi.mock("@/lib/audit", () => ({ emitAuditLog: vi.fn() }));
vi.mock("@/lib/api/auth-helpers", () => ({
  getRequestContext: () => ({ ipAddress: "192.0.2.10", userAgent: "test" }),
  badRequest: (error: string, details?: unknown) =>
    NextResponse.json({ error, details }, { status: 400 }),
}));
vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  rateLimitedResponse: vi.fn(),
}));
vi.mock("@/lib/mail/send", () => ({ sendMail: vi.fn() }));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as contact } from "@/app/api/contact/route";

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("gateway-mode production routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayMocks.shouldUse.mockReturnValue(true);
    gatewayMocks.login.mockResolvedValue({
      token: "gateway-token",
      expiresIn: 3600,
      session: {
        userId: "admin-1",
        email: "admin@gemcybersecurityassist.com",
        role: "admin",
        kycStatus: "approved",
        entitlements: [],
        sessionVersion: 7,
        authSource: "supabase_gateway",
      },
    });
    contactGatewayMocks.submit.mockResolvedValue({
      ok: true,
      accepted: true,
      submissionId: "submission-1",
      ticketId: null,
      persistence: "supabase_gateway",
      notificationDelivery: "not_configured",
    });
  });

  it("issues a wrapped gateway login without querying Prisma", async () => {
    const response = await login(
      post("/api/auth/login", {
        email: "admin@gemcybersecurityassist.com",
        password: "Strong-Password-For-Test-2026!",
        portal: "admin",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(response.headers.get("x-test-session-token")).toBe(
      "sg1.gateway-token",
    );
    expect(gatewayMocks.login).toHaveBeenCalledOnce();
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled();
    expect(dbMocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects a valid gateway account at the wrong portal", async () => {
    const response = await login(
      post("/api/auth/login", {
        email: "admin@gemcybersecurityassist.com",
        password: "Strong-Password-For-Test-2026!",
        portal: "client",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("ROLE_PORTAL_MISMATCH");
    expect(response.headers.get("x-test-session-token")).toBeNull();
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("fails closed when a gateway login lacks sessionVersion", async () => {
    gatewayMocks.login.mockResolvedValue({
      token: "legacy-token",
      expiresIn: 3600,
      session: {
        userId: "admin-1",
        email: "admin@gemcybersecurityassist.com",
        role: "admin",
        kycStatus: "approved",
        entitlements: [],
        authSource: "supabase_gateway",
      },
    });

    const response = await login(
      post("/api/auth/login", {
        email: "admin@gemcybersecurityassist.com",
        password: "Strong-Password-For-Test-2026!",
        portal: "admin",
      }),
    );

    expect(response.status).toBe(401);
    expect(dbMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("persists a public contact through the gateway without Prisma or session access", async () => {
    const response = await contact(
      post("/api/contact", {
        name: "GEM Test",
        email: "test@example.com",
        subject: "Gateway persistence check",
        message: "This is a valid non-production unit-test message.",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      submissionId: "submission-1",
      persistence: "supabase_gateway",
    });
    expect(contactGatewayMocks.submit).toHaveBeenCalledOnce();
    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(dbMocks.supportBookingCreate).not.toHaveBeenCalled();
    expect(dbMocks.supportTicketCreate).not.toHaveBeenCalled();
  });
});
