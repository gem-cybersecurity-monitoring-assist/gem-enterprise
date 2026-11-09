import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("customer-scoped SaaS service request history", () => {
  it("requires the authenticated request owner and active organization membership", () => {
    const route = read("src/app/api/requests/[id]/timeline/route.ts");
    expect(route).toContain("await requireSession()");
    expect(route).toContain('gate.accountStatus !== "active"');
    expect(route).toContain("id, userId: gate.session.userId");
    expect(route).toContain("db.workspaceMember.findFirst(");
    expect(route).toContain('status: "active"');
    expect(route).toContain('status: 404');
    expect(route).toContain("private, no-store, max-age=0");
  });

  it("does not expose audit notes, internal reviewer emails, IP addresses or actor IDs", () => {
    const route = read("src/app/api/requests/[id]/timeline/route.ts");
    expect(route).toContain("select: { action: true, metadata: true, createdAt: true }");
    expect(route).toContain("const events = rows.flatMap(");
    expect(route).toContain("kind: created ? ");
    expect(route).toContain("historyLimitedTo: 100");
    expect(route).not.toContain("ipAddress: true");
    expect(route).not.toContain("userAgent: true");
    expect(route).not.toContain("user: {");
    expect(route).not.toContain("metadata: row.metadata");
  });

  it("adds an accessible lazy-loaded activity timeline to the existing request center", () => {
    const page = read("src/app/app/requests/page.tsx");
    const ui = read("src/components/requests/RequestTimeline.tsx");
    expect(page).toContain("<RequestTimeline requestId={request.id} />");
    expect(ui).toContain('aria-expanded={open}');
    expect(ui).toContain('cache: "no-store"');
    expect(ui).toContain('credentials: "same-origin"');
    expect(ui).toContain("if (!open) return");
    expect(ui).toContain("Request history could not be verified");
  });
});
