import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  account: vi.fn(),
  membership: vi.fn(),
  databaseAllowed: vi.fn(),
  localSession: vi.fn(),
  localWorkspace: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionFromRequest: mocks.session }));
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: mocks.account },
  workspaceMember: { findFirst: mocks.membership },
} }));
vi.mock("@/lib/social-media/transactional-authority", () => ({
  hasSocialTransactionalAuthority: mocks.databaseAllowed,
}));
vi.mock("@/lib/tokmetric/security", () => ({
  requireActiveTokMetricSession: mocks.localSession,
  requireWorkspaceAccess: mocks.localWorkspace,
  TokMetricError: class extends Error {
    constructor(readonly statusCode: number, readonly code: string, message: string) {
      super(message);
    }
  },
}));

import { requireSocialConnectorSession, requireSocialConnectorWorkspace } from "@/lib/social-media/connector-authority";
import type { SessionPayload } from "@/lib/auth";

const session: SessionPayload = {
  userId: "user-1", email: "operator@example.test", role: "admin",
  kycStatus: "approved", entitlements: [], authSource: "supabase_gateway", sessionVersion: 2,
};
const request = {} as NextRequest;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(session);
  mocks.databaseAllowed.mockReturnValue(true);
  mocks.account.mockResolvedValue({ ...session, id: session.userId, status: "active", isActive: true });
});

describe("gateway social connector authority", () => {
  it("blocks gateway access before any database read when the project binding is off", async () => {
    mocks.databaseAllowed.mockReturnValue(false);
    await expect(requireSocialConnectorSession(request)).rejects.toMatchObject({ code: "SOCIAL_CONNECTOR_BACKEND_REQUIRED" });
    expect(mocks.account).not.toHaveBeenCalled();
  });

  it("checks the current account and rejects revoked sessions", async () => {
    await expect(requireSocialConnectorSession(request)).resolves.toMatchObject({ userId: session.userId });
    mocks.account.mockResolvedValue({ ...session, id: session.userId, sessionVersion: 3, status: "active", isActive: true });
    await expect(requireSocialConnectorSession(request)).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("rejects workspace access even for platform admins without active membership", async () => {
    mocks.membership.mockResolvedValue(null);
    await expect(requireSocialConnectorWorkspace("workspace-1", session)).rejects.toMatchObject({ code: "WORKSPACE_FORBIDDEN" });
    expect(mocks.membership).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: "workspace-1", userId: "user-1", status: "active", workspace: { organization: { status: "active" } } },
    }));
  });
});
