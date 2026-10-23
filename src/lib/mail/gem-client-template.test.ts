import { describe, expect, it } from "vitest";
import {
  buildGemClientEmail,
  buildWorkspaceOwnerInvitationEmail,
} from "@/lib/mail/gem-client-template";

describe("buildGemClientEmail", () => {
  it("renders the designated GEM masthead, metadata, CTA, and plain-text fallback", () => {
    const result = buildGemClientEmail({
      preheader: "Secure workspace ready",
      communicationLabel: "Official Client Project Communication",
      title: "Secure Workspace Access & Activation",
      reference: "Workspace Access Invitation",
      clientName: "Test Client",
      projectName: "Project Atlas",
      organizationName: "Atlas LLC",
      status: "Activation Required",
      greetingName: "Test Client",
      paragraphs: ["Your workspace is ready."],
      cta: {
        label: "ACTIVATE SECURE WORKSPACE",
        url: "https://www.gemcybersecurityassist.com/workspace-invitation#test-token",
      },
      securityNotice: "Keep this link private.",
    });

    expect(result.html).toContain("GEM Cybersecurity &amp;<br>Monitoring Assist");
    expect(result.html).toContain("Official Client Project Communication");
    expect(result.html).toContain("Workspace Access Invitation");
    expect(result.html).toContain("ACTIVATE SECURE WORKSPACE");
    expect(result.html).toContain('name="viewport"');
    expect(result.text).toContain("Project: Project Atlas");
    expect(result.text).toContain("Keep this link private.");
  });

  it("escapes client-controlled text before rendering HTML", () => {
    const result = buildGemClientEmail({
      preheader: "Preview",
      communicationLabel: "Official Communication",
      title: "Security Notice",
      clientName: '<script>alert("x")</script>',
      paragraphs: ["Use <b>safe</b> content."],
    });

    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("<b>safe</b>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&lt;b&gt;safe&lt;/b&gt;");
  });

  it("rejects non-HTTPS action URLs", () => {
    expect(() =>
      buildGemClientEmail({
        preheader: "Preview",
        communicationLabel: "Official Communication",
        title: "Action",
        paragraphs: ["Action required."],
        cta: { label: "OPEN", url: "javascript:alert(1)" },
      }),
    ).toThrow("must use HTTPS");
  });
});

describe("buildWorkspaceOwnerInvitationEmail", () => {
  const baseInput = {
    to: "client@example.com",
    clientName: "Test Client",
    projectName: "Project Atlas",
    organizationName: "Atlas LLC",
    activationUrl:
      "https://www.gemcybersecurityassist.com/workspace-invitation#fake-test-token",
    expiresAt: "2026-08-24T14:43:00.000Z",
  };

  it("builds the official workspace invitation without hard-coded credentials", () => {
    const result = buildWorkspaceOwnerInvitationEmail(baseInput);

    expect(result.subject).toBe(
      "GEM Enterprise — Official Client Workspace Invitation",
    );
    expect(result.html).toContain("Secure Workspace Ready — Activation Required");
    expect(result.html).toContain("Project Atlas");
    expect(result.text).toContain("Organization: Atlas LLC");
    expect(result.text).toContain("Invitation expires");
    expect(result.html).not.toContain("password=");
  });

  it("rejects activation links outside the canonical GEM invitation route", () => {
    expect(() =>
      buildWorkspaceOwnerInvitationEmail({
        ...baseInput,
        activationUrl: "https://example.com/workspace-invitation#fake-test-token",
      }),
    ).toThrow("canonical GEM invitation URL");

    expect(() =>
      buildWorkspaceOwnerInvitationEmail({
        ...baseInput,
        activationUrl: "https://www.gemcybersecurityassist.com/login#fake-test-token",
      }),
    ).toThrow("canonical GEM invitation URL");
  });

  it("requires a one-time token fragment in the activation URL", () => {
    expect(() =>
      buildWorkspaceOwnerInvitationEmail({
        ...baseInput,
        activationUrl: "https://www.gemcybersecurityassist.com/workspace-invitation",
      }),
    ).toThrow("canonical GEM invitation URL");
  });
});
