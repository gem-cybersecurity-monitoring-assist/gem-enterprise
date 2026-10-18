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

export const accessPortalEntries: readonly AccessPortalEntry[] = [
  {
    id: "login",
    label: "Secure sign-in directory",
    shortLabel: "Login",
    href: "/login",
    destination: "Choose the portal assigned to your account",
    description:
      "Start here when you are unsure which GEM portal your account is assigned to.",
    accent: "cyan",
  },
  {
    id: "client",
    label: "Client portal",
    shortLabel: "Client portal",
    href: "/client-login",
    destination: "Assigned client workspace",
    description:
      "Use only a client account to open assigned organizations, projects, services, documents, requests, and reporting.",
    accent: "cyan",
  },
  {
    id: "team",
    label: "Team workspace",
    shortLabel: "Team portal",
    href: "/team-login",
    destination: "Assigned team workspace",
    description:
      "Use only an assigned team or review account to open delivery work, tools, meetings, tasks, and reporting.",
    accent: "emerald",
  },
  {
    id: "admin",
    label: "Admin portal",
    shortLabel: "Admin login",
    href: "/admin-login",
    destination: "Admin Center",
    description:
      "Use only an assigned administrator account for approved users, reviews, operations, evidence, and delegated controls.",
    accent: "amber",
  },
  {
    id: "super_admin",
    label: "Super Admin",
    shortLabel: "Super Admin",
    href: "/super-admin-login",
    destination: "Super Admin control center",
    description:
      "Use only a platform-owner account for organizations, workspace access, system operations, audit evidence, and platform policy.",
    accent: "violet",
  },
] as const;

export function accessPortalById(id: AccessPortalId) {
  return accessPortalEntries.find((portal) => portal.id === id);
}
