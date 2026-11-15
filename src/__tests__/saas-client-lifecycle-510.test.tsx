import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/command-center/SaaSOperationalSnapshot", () => ({ SaaSOperationalSnapshot: () => null }));
vi.mock("@/components/command-center/SaaSManagementWorkspace", () => ({ SaaSManagementWorkspace: () => null }));
vi.mock("@/components/command-center/SaaSAssignedWorkspaces", () => ({ SaaSAssignedWorkspaces: () => null }));
vi.mock("@/components/command-center/SaaSArchitectureDeck", () => ({ SaaSArchitectureDeck: () => null }));

import { SaaSClientActivationJourney, clientActivationStages } from "@/components/command-center/SaaSClientActivationJourney";
import SaaSControlPlanePage from "@/app/app/command-center/saas/page";

describe("SaaS new client onboarding dashboard", () => {
  it("reuses all six existing lifecycle stages without changing authorizations", () => {
    expect(clientActivationStages.map((stage) => stage.href)).toEqual([
      "/enterprise/apply",
      "/app/admin/intake",
      "/app/admin/workspace-access",
      "/workspace-invitation",
      "/client-login?next=%2Fapp%2Fworkspace",
      "/app/requests",
    ]);
    const html = renderToStaticMarkup(<SaaSClientActivationJourney />);
    for (const stage of clientActivationStages) {
      expect(html).toContain(stage.title);
      expect(html).toContain(stage.status);
      expect(html).toContain(stage.href.replace(/&/g, "&amp;"));
    }
    expect(html).toContain("Built pages do not automatically create accounts.");
    expect(html).toContain("No publishing, billing,");
    expect(html).not.toContain("All connections active");
  });

  it("is visible on the existing SaaS management page without displacing existing tools", () => {
    const html = renderToStaticMarkup(<SaaSControlPlanePage />);
    expect(html).toContain("Application to operating workspace");
    expect(html).toContain("Your business. One workspace.");
    expect(html).toContain("Open backend completion center");
  });
});
