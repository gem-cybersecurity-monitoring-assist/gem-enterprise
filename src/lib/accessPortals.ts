export type AccessPortalId = "login" | "client" | "team" | "admin" | "super_admin";

export interface AccessPortalEntry {
  id: AccessPortalId;
  label: string;
  shortLabel: string;
  href: string;
  destination: string;
  description: string;
  accent: "cyan" | "emerald" | "amber" | "violet";
}

const allPortalEntries: readonly AccessPortalEntry[] = [
  {
    id: "login",
    label: "Secure sign-in directory",
    shortLabel: "Login",
    href: "/login",
    destination: "Choose the correct protected doorway",
    description:
      "Start here when you are unsure which GEM portal your account is assigned to.",
    accent: "cyan",
  },
  {
    id: "client",
    label: "Client portal",
    shortLabel: "Client portal",
    href: "/client-login?next=%2Fapp%2Fworkspace",
    destination: "Organization Workspace OS",
    description:
      "Open assigned organizations, projects, services, documents, requests, and reporting.",
    accent: "cyan",
  },
  {
    id: "team",
    label: "Team workspace",
    shortLabel: "Team portal",
    href: "/team-login?next=%2Fapp%2Fworkspace",
    destination: "Assigned project environments",
    description:
      "Open assigned delivery work, tools, meetings, tasks, and weekly reporting.",
    accent: "emerald",
  },
  {
    id: "admin",
    label: "Admin portal",
    shortLabel: "Admin login",
    href: "/admin-login?next=%2Fapp%2Fadmin",
    destination: "Scoped administration",
    description:
      "Manage approved users, reviews, operations, evidence, and delegated controls.",
    accent: "amber",
  },
  {
    id: "super_admin",
    label: "Super Admin",
    shortLabel: "Super Admin",
    href: "/super-admin-login?next=%2Fapp%2Fadmin",
    destination: "Owner control plane",
    description:
      "Govern organizations, workspace access, system operations, audit evidence, and platform policy.",
    accent: "violet",
  },
] as const;

export const accessPortalEntries = allPortalEntries.filter(({ id }) => id === "login" || id === "client" || id === "team");

export function accessPortalById(id: AccessPortalId) {
  return allPortalEntries.find((portal) => portal.id === id);
}
