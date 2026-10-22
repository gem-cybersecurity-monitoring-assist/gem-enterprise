/**
 * roleGating.test.ts (WS-G)
 *
 * Unit tests for the role helpers in src/lib/api/auth-helpers.ts.
 * Pure-function tests only: no database, no network, no secrets.
 *
 * NOTE on module loading: src/lib/api/auth-helpers.ts transitively imports
 * @/lib/db (which instantiates PrismaClient at module load; the client is
 * NOT generated in this sandbox) and @/lib/auth (a heavy session chain),
 * so both are stubbed below. The role predicates under test are pure and
 * do not depend on the stubs.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import {
  isAdminRole,
  isPlatformOwnerRole,
  isStaffRole,
} from "@/lib/api/auth-helpers";

describe("isAdminRole", () => {
  it("accepts admin, super_admin, and internal", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("internal")).toBe(true);
  });

  it("rejects client and analyst", () => {
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole("analyst")).toBe(false);
  });

  it("fails closed on unknown, empty, and missing roles", () => {
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole("owner")).toBe(false);
    expect(isAdminRole("godmode")).toBe(false);
  });

  it("is case-sensitive: ADMIN is not admin", () => {
    expect(isAdminRole("ADMIN")).toBe(false);
    expect(isAdminRole(" Admin")).toBe(false);
  });
});

describe("isStaffRole", () => {
  it("accepts analyst, admin, super_admin, and internal", () => {
    expect(isStaffRole("analyst")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("super_admin")).toBe(true);
    expect(isStaffRole("internal")).toBe(true);
  });

  it("admin implies staff", () => {
    for (const role of ["admin", "super_admin", "internal"] as const) {
      expect(isAdminRole(role)).toBe(true);
      expect(isStaffRole(role)).toBe(true);
    }
  });

  it("analyst is staff but not admin", () => {
    expect(isStaffRole("analyst")).toBe(true);
    expect(isAdminRole("analyst")).toBe(false);
  });

  it("client role is neither admin nor staff", () => {
    expect(isAdminRole("client")).toBe(false);
    expect(isStaffRole("client")).toBe(false);
    expect(isPlatformOwnerRole("client")).toBe(false);
  });

  it("fails closed on unknown, empty, and missing roles", () => {
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole("")).toBe(false);
    expect(isStaffRole("viewer")).toBe(false);
    expect(isStaffRole("STAFF")).toBe(false);
  });
});

describe("isPlatformOwnerRole", () => {
  it("only super_admin is the platform owner", () => {
    expect(isPlatformOwnerRole("super_admin")).toBe(true);
    expect(isPlatformOwnerRole("admin")).toBe(false);
    expect(isPlatformOwnerRole("internal")).toBe(false);
    expect(isPlatformOwnerRole("analyst")).toBe(false);
    expect(isPlatformOwnerRole("client")).toBe(false);
  });

  it("the platform owner is also an admin and staff", () => {
    expect(isPlatformOwnerRole("super_admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isStaffRole("super_admin")).toBe(true);
  });

  it("fails closed on unknown, empty, and missing roles", () => {
    expect(isPlatformOwnerRole(undefined)).toBe(false);
    expect(isPlatformOwnerRole(null)).toBe(false);
    expect(isPlatformOwnerRole("")).toBe(false);
    expect(isPlatformOwnerRole("platform_owner")).toBe(false);
    expect(isPlatformOwnerRole("SUPER_ADMIN")).toBe(false);
  });
});

describe("role hierarchy", () => {
  it("platform owner ⊆ admin ⊆ staff, and client sits outside all three", () => {
    const hierarchy: Array<{ role: string; admin: boolean; staff: boolean; owner: boolean }> = [
      { role: "super_admin", admin: true, staff: true, owner: true },
      { role: "admin", admin: true, staff: true, owner: false },
      { role: "internal", admin: true, staff: true, owner: false },
      { role: "analyst", admin: false, staff: true, owner: false },
      { role: "client", admin: false, staff: false, owner: false },
    ];
    for (const { role, admin, staff, owner } of hierarchy) {
      expect(isAdminRole(role)).toBe(admin);
      expect(isStaffRole(role)).toBe(staff);
      expect(isPlatformOwnerRole(role)).toBe(owner);
      if (admin) expect(staff).toBe(true);
      if (owner) expect(admin).toBe(true);
    }
  });
});
