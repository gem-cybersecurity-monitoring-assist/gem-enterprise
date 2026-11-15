import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/intake/PublicIntakeForm", () => ({
  PublicIntakeForm: ({ kind }: { kind: string }) =>
    <form action={`/api/intake/${kind.toLowerCase()}`} data-canonical-kind={kind} />,
}));

import GetStartedPage from "@/app/get-started/page";
import EligibilityStatusPage from "@/app/eligibility/status/page";
import RequestAccessPage from "@/app/request-access/page";

describe("new client entry flows", () => {
  it("routes enterprise applicants to the dedicated enterprise qualification flow", () => {
    const html = renderToStaticMarkup(<GetStartedPage />);
    expect(html).toContain('href="/enterprise/apply"');
    expect(html).toContain("Submit enterprise application");
    expect(html).not.toContain('href="/request-access"');
    expect(html).toContain("one-time organization invitation");
    expect(html).toContain('href="/client-login"');
    expect(html).not.toContain("automatically creates");
  });

  it("routes eligibility applicants to Enterprise, not future Community", () => {
    const html = renderToStaticMarkup(<EligibilityStatusPage />);
    expect(html).toContain('href="/enterprise/apply"');
    expect(html).not.toContain('href="/request-access"');
    expect(html).toContain("Apply for Enterprise Services");
  });

  it("keeps legacy /request-access usable via the dedicated Community intake backend", () => {
    const html = renderToStaticMarkup(<RequestAccessPage />);
    expect(html).toContain('data-canonical-kind="COMMUNITY"');
    expect(html).toContain('action="/api/intake/community"');
    expect(html).not.toContain("10 business days");
    expect(html).not.toContain('hub_access_request');
    expect(html).toContain('href="/enterprise/apply"');
    expect(html).toContain("does not grant membership");
  });
});
