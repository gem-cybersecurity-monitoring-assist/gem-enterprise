import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  createDeterministicSupportReply,
  createSupportSuggestedReplies,
  retrieveSupportKnowledge,
} from "@/lib/ai/support-knowledge";
import {
  canAccessSupportTicket,
  isSupportStaff,
  parseSupportThreadMessage,
  supportMessageNotificationData,
} from "@/lib/support/live-support";
import {
  containsSensitiveSupportInput,
  requireSameOriginSupportRequest,
  SupportSecurityError,
} from "@/lib/support/security";

describe("complete AI and live-support flow", () => {
  it("returns specific verified guidance instead of one repetitive generic answer", () => {
    const workspace = createDeterministicSupportReply(
      "Where do I manage my organization workspace?",
      retrieveSupportKnowledge("Where do I manage my organization workspace?"),
    );
    const video = createDeterministicSupportReply(
      "How do I use the video studio and OBS?",
      retrieveSupportKnowledge("How do I use the video studio and OBS?"),
    );

    expect(workspace).toContain("Organization Workspace");
    expect(workspace).toContain("verified membership");
    expect(video).toContain("Video Studio");
    expect(video).toContain("Windows media host");
    expect(workspace).not.toBe(video);
  });

  it("grounds current platform areas in real internal routes", () => {
    expect(retrieveSupportKnowledge("Take me to the command center")[0]).toMatchObject({
      title: "Command Center",
      href: "/app/command-center",
    });
    expect(retrieveSupportKnowledge("I need to publish a TikTok campaign")[0]).toMatchObject({
      title: "Social Media Hub",
      href: "/app/social-media",
    });
  });

  it("understands account creation and detailed GEM Assist questions", () => {
    const accountQuery = "I want to create account";
    const accountEntries = retrieveSupportKnowledge(accountQuery);
    expect(accountEntries[0]).toMatchObject({ title: "Access intake", href: "/eligibility" });
    expect(createDeterministicSupportReply(accountQuery, accountEntries)).toContain("create a GEM account");
    expect(createSupportSuggestedReplies(accountQuery, accountEntries)).toContain("I already submitted an application");

    const offerQuery = "What does GEM Assist offer in details?";
    const offerEntries = retrieveSupportKnowledge(offerQuery);
    expect(offerEntries[0]).toMatchObject({ title: "Products and services", href: "/app/products" });
    expect(createDeterministicSupportReply(offerQuery, offerEntries)).toContain("organization Workspace OS");
  });

  it("asks a focused clarification rather than repeating a catalogue fallback", () => {
    const reply = createDeterministicSupportReply("Can you sort this out for me?", []);
    expect(reply).toContain("understand your request correctly");
    expect(reply).toContain("transfer the conversation to a human support agent");
    expect(reply).not.toContain("I can help with your GEM account, organization workspace");
  });

  it("blocks credential-like input and valid payment-card numbers before persistence", () => {
    expect(containsSensitiveSupportInput("password: not-for-chat")).toBe(true);
    expect(containsSensitiveSupportInput("Use card 4242 4242 4242 4242")).toBe(true);
    expect(containsSensitiveSupportInput("I forgot my password and need the recovery page")).toBe(false);
  });

  it("requires an explicit same-origin browser mutation", () => {
    const accepted = new NextRequest("https://gem.example/api/support/message", {
      method: "POST",
      headers: { origin: "https://gem.example", "sec-fetch-site": "same-origin" },
    });
    expect(() => requireSameOriginSupportRequest(accepted)).not.toThrow();

    const rejected = new NextRequest("https://gem.example/api/support/message", {
      method: "POST",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    });
    expect(() => requireSameOriginSupportRequest(rejected)).toThrowError(SupportSecurityError);
  });

  it("keeps client cases private while allowing verified support staff", () => {
    expect(canAccessSupportTicket("client", "client-1", "client-1")).toBe(true);
    expect(canAccessSupportTicket("client", "client-2", "client-1")).toBe(false);
    expect(canAccessSupportTicket("analyst", "analyst-1", "client-1")).toBe(true);
    expect(isSupportStaff("admin")).toBe(true);
    expect(isSupportStaff("client")).toBe(false);
  });

  it("serializes only support-thread notification records", () => {
    const createdAt = new Date("2026-08-20T00:00:00.000Z");
    const data = supportMessageNotificationData({
      ticketId: "ticket-1",
      actorType: "staff",
      actorId: "agent-1",
      actorRole: "analyst",
    });
    expect(parseSupportThreadMessage({ id: "message-1", body: "How can I help?", data, createdAt })).toEqual({
      id: "message-1",
      message: "How can I help?",
      actorType: "staff",
      actorId: "agent-1",
      actorRole: "analyst",
      createdAt: "2026-08-20T00:00:00.000Z",
    });
    expect(parseSupportThreadMessage({ id: "message-2", body: "Ignore", data: {}, createdAt })).toBeNull();
  });
});
