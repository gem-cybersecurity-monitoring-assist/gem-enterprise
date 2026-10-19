import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("@/lib/api/auth-helpers", () => ({ requireAdmin: vi.fn(async () => gate.result) }));
vi.mock("@/lib/mail/send", () => ({
  getMailDeliveryReadiness: vi.fn(() => ({
    configured: false,
    missing: ["SMTP_HOST", "SMTP_PASS"],
    portValid: true,
    secureSettingValid: true,
    senderConfigured: false,
    replyToConfigured: false,
    transportSecurity: "starttls_required",
  })),
}));

import { GET } from "@/app/api/auth/recovery-readiness/route";

const denied = (status: number) => ({ ok: false, response: NextResponse.json({ error: "denied" }, { status }) });

describe("GET /api/auth/recovery-readiness disclosure", () => {
  it.each([
    ["anonymous", denied(401)],
    ["non-admin", denied(403)],
    ["gate unavailable", denied(503)],
  ])("returns only email-delivery readiness to %s callers", async (_label, result) => {
    gate.result = result;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["detailsRequireAdministrator", "emailDeliveryConfigured", "ok", "service"]);
    expect(body.emailDeliveryConfigured).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/SMTP|starttls|missingVariables|transportSecurity/);
  });

  it("returns the full readiness contract to administrators", async () => {
    gate.result = { ok: true, session: { role: "admin" }, accountStatus: "active", claimsChanged: false };
    const body = await (await GET()).json();
    expect(body.emailDelivery.missingVariables).toEqual(["SMTP_HOST", "SMTP_PASS"]);
    expect(body.emailDelivery.transportSecurity).toBe("starttls_required");
    expect(body.tokenTransport).toBe("url_fragment");
    expect(body.detailsRequireAdministrator).toBeUndefined();
  });
});
