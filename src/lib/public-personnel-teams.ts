import { divisions, enterpriseTeams, type EnterpriseDivision } from "@/lib/enterprise-team-catalog";

/**
 * Public-safe, role-only view of GEM's documented organizational model.
 * Do not expose historical named roster records, private source URLs,
 * internal work evidence or restricted executive desks on public routes.
 */
export interface PublicFunctionalTeam {
  slug: string;
  title: string;
  division: EnterpriseDivision;
  overview: string;
  mission: string;
  responsibilities: readonly string[];
  deliverables: readonly string[];
  status: "documented" | "planned";
}

const PUBLICLY_DESCRIBABLE_DIVISIONS: readonly EnterpriseDivision[] = ["executive", "security", "realty", "shared"];

export const publicDivisions = divisions
  .filter((division) => PUBLICLY_DESCRIBABLE_DIVISIONS.includes(division.id))
  .map((division) => ({
    id: division.id,
    title: division.title,
    subtitle: division.subtitle,
  }));

export const publicFunctionalTeams: readonly PublicFunctionalTeam[] = enterpriseTeams
  .filter((team) =>
    team.status !== "restricted" &&
    PUBLICLY_DESCRIBABLE_DIVISIONS.includes(team.division) &&
    team.slug !== "vip-relationships"
  )
  .map((team) => ({
    slug: team.slug,
    title: team.title,
    division: team.division,
    overview: team.strap,
    mission: team.summary,
    responsibilities: team.responsibilities,
    deliverables: team.deliverables,
    status: team.status === "documented" ? "documented" as const : "planned" as const,
  }));

export function getPublicFunctionalTeam(slug: string): PublicFunctionalTeam | null {
  return publicFunctionalTeams.find((team) => team.slug === slug) ?? null;
}
