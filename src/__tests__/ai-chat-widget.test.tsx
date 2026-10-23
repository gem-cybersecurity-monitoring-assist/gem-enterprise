// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AIChatWidget } from "@/components/AIChatWidget";

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AIChatWidget", () => {
  it("starts both governed sessions and creates a tracked human handoff", async () => {
    let uuid = 0;
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn(async () => new Uint8Array(32).fill(1).buffer),
      },
      randomUUID: vi.fn(() => `uuid-${++uuid}`),
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/assistant/session") return response({ ok: true, sessionId: "ai-run-1" });
      if (url === "/api/support/session/start") {
        return response({ sessionId: "support-1", requiresConsent: true });
      }
      if (url === "/api/support/session/consent") {
        return response({ success: true, greeting: "Secure session ready." });
      }
      if (url === "/api/support/message") {
        return response({
          messageId: "assistant-1",
          reply: "I am recording a human-support handoff now.",
          shouldEscalate: true,
          knowledgeLinks: [],
          suggestedReplies: [],
          handoff: {
            success: true,
            queue: "General Member Support",
            channel: "gem_ticket",
            ticketId: "ticket-123",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AIChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Open AI support chat" }));
    expect(screen.getByRole("heading", { name: "AI interaction disclosure" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Accept & continue" }));
    expect(await screen.findByText("Secure session ready.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Request human support" }));
    expect(await screen.findByRole("heading", { name: "Human-support request recorded" })).toBeTruthy();
    expect(screen.getByText("ticket-123")).toBeTruthy();
    expect(screen.getByText(/conversation and the attempted resolution are attached/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Reply and track updates/i }).getAttribute("href")).toBe("/app/support?ticket=ticket-123");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/support/message",
        expect.objectContaining({
          body: expect.stringContaining('\"aiRunId\":\"ai-run-1\"'),
        }),
      );
    });
  });
});
