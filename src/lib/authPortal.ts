import type { AuthRole } from "@/lib/auth";

export type LoginPortalKind = "client" | "team" | "admin" | "super_admin";

const PORTAL_ROLES: Record<LoginPortalKind, readonly AuthRole[]> = {
  client: ["client"],
  team: ["analyst"],
  admin: ["admin", "internal"],
  super_admin: ["super_admin"],
};

const ROLE_HOME: Record<AuthRole, string> = {
  client: "/access/continue",
  analyst: "/review/verification",
  admin: "/app/admin",
  internal: "/app/admin",
  super_admin: "/app/super-admin",
};

const ROLE_LOGIN: Record<AuthRole, string> = {
  client: "/client-login",
  analyst: "/team-login",
  admin: "/admin-login",
  internal: "/admin-login",
  super_admin: "/super-admin-login",
};

export function isRoleAllowedForPortal(
  role: AuthRole,
  portal: LoginPortalKind,
): boolean {
  return PORTAL_ROLES[portal].includes(role);
}

export function homeForRole(role: AuthRole): string {
  return ROLE_HOME[role];
}

export function loginPathForRole(role: AuthRole): string {
  return ROLE_LOGIN[role];
}

export function portalForRole(role: AuthRole): LoginPortalKind {
  if (role === "client") return "client";
  if (role === "analyst") return "team";
  if (role === "super_admin") return "super_admin";
  return "admin";
}
