import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const navigationSource = readFileSync("src/lib/platformNavigation.ts", "utf8");
const appLayoutSource = readFileSync("src/app/app/layout.tsx", "utf8");
const proxySource = readFileSync("src/proxy.ts", "utf8");
const suiteLayoutSource = readFileSync("src/app/app/social-media/layout.tsx", "utf8");
const overviewSource = readFileSync("src/app/app/social-media/page.tsx", "utf8");
const accountsSource = readFileSync("src/app/app/social-media/accounts/page.tsx", "utf8");
const contentSource = readFileSync("src/app/app/social-media/content/page.tsx", "utf8");
const videoSource = readFileSync("src/app/app/social-media/video/page.tsx", "utf8");
const tokMetricSource = readFileSync("src/app/app/social-media/tokmetric/page.tsx", "utf8");
const approvalsSource = readFileSync("src/app/app/social-media/approvals/page.tsx", "utf8");
const calendarSource = readFileSync("src/app/app/social-media/calendar/page.tsx", "utf8");
const analyticsSource = readFileSync("src/app/app/social-media/analytics/page.tsx", "utf8");
const queuePanelSource = readFileSync("src/components/social-media/SocialPublishingQueuePanel.tsx", "utf8");
const connectorPanelSource = readFileSync("src/components/social-media/SocialConnectorPanel.tsx", "utf8");

describe("client-facing Social Media Suite", () => {
  it("registers the suite as a normal authenticated website workspace", () => {
    expect(navigationSource).toContain('href: "/app/social-media"');
    expect(navigationSource).toContain('label: "Social Media Suite"');
    expect(suiteLayoutSource).toContain("Client and team workspace");
    expect(overviewSource).toContain("Managed publishing lifecycle");
  });

  it("keeps the Command Center administrator-only in navigation and middleware", () => {
    expect(navigationSource).toContain('label: "Command Center"');
    expect(navigationSource).toContain("adminOnly: true");
    expect(appLayoutSource).toContain("if (ADMIN_ROLES.has(role ?? \"\"))");
    expect(appLayoutSource).toContain('label: "Operations"');
    expect(appLayoutSource).toContain('"/app/command-center"');
    expect(proxySource).toContain('"/app/command-center"');
    expect(proxySource).toContain('["admin", "super_admin", "internal"]');
  });

  it("provides the complete suite management surfaces", () => {
    expect(accountsSource).toContain("SocialConnectorPanel");
    expect(contentSource).toContain("ContentOrchestratorPanel");
    expect(videoSource).toContain("GovernedVideoPreviewPanel");
    expect(approvalsSource).toContain("Mandatory publication checks");
    expect(calendarSource).toContain("Publishing calendar and queue preparation");
    expect(calendarSource).toContain("SocialPublishingQueuePanel");
    expect(queuePanelSource).toContain("/api/social-media/publishing/jobs?workspaceId=");
    expect(queuePanelSource).toContain("This console cannot create, process, retry, or publish");
    expect(queuePanelSource).not.toContain('method: "POST"');
    expect(analyticsSource).toContain("Metric source labels");
  });

  it("resolves the GEM Admin publishing workspace without a manual ID", () => {
    expect(accountsSource).toContain("CONTENT_ORCHESTRATOR_WORKSPACE_ID");
    expect(accountsSource).toContain("CONTENT_ORCHESTRATOR_ACTOR_ID");
    expect(accountsSource).toContain("organizationId: serviceActor.organizationId");
    expect(accountsSource).not.toContain("ws_60488340ded94dcfab3b875ef9ae591c");
    expect(accountsSource).toContain("allowManualWorkspaceInput={false}");
    expect(connectorPanelSource).toContain("allowManualWorkspaceInput");
    expect(connectorPanelSource).toContain("server-side configuration issue");
  });

  it("makes TokMetric a full website page with every existing operating module", () => {
    expect(tokMetricSource).toContain('href: "/tokmetric/accounts"');
    expect(tokMetricSource).toContain('href: "/tokmetric/content-studio"');
    expect(tokMetricSource).toContain('href: "/tokmetric/compliance"');
    expect(tokMetricSource).toContain('href: "/tokmetric/approvals"');
    expect(tokMetricSource).toContain('href: "/tokmetric/publishing"');
    expect(tokMetricSource).toContain('href: "/tokmetric/analytics"');
    expect(tokMetricSource).toContain('href: "/tokmetric/developer"');
    expect(tokMetricSource).toContain('href: "/tokmetric/agents"');
    expect(tokMetricSource).toContain("TokMetricConnectorPanel");
  });

  it("retains fail-closed publication language throughout the client experience", () => {
    expect(overviewSource).toContain("Connecting an account does not automatically authorize publication");
    expect(contentSource).toContain("does not equal approval or publication");
    expect(videoSource).toContain("Private preview does not publish");
    expect(calendarSource).toContain("does not publish unapproved content");
  });
});
