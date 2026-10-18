import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectWorkspaceShell } from "@/components/workspace/ProjectWorkspaceShell";
import { requireSession } from "@/lib/api/auth-helpers";
import { resolveAccessDestination } from "@/lib/auth";
import { getOrganizationProjectWorkspace } from "@/lib/organizationWorkspace";
import { canOpenProjectEnvironment, isProjectEnvironment, projectEnvironments } from "@/lib/projectWorkspace";

export const metadata: Metadata = { title: "Project Workspace | GEM Enterprise", description: "Membership-scoped project operating workspace." };
export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({params}:{params:Promise<{projectId:string;environment?:string[]}>}) {
  const gate = await requireSession();
  if (!gate.ok) redirect("/client-login");
  if (gate.session.role !== "client") redirect(resolveAccessDestination(gate.session));
  if (gate.accountStatus !== "active") redirect("/client-login?status=account-review");
  const {projectId,environment:parts} = await params;
  const requested = parts?.[0] ?? "overview";
  if (parts && parts.length > 1 || !isProjectEnvironment(requested)) notFound();
  let context: Awaited<ReturnType<typeof getOrganizationProjectWorkspace>>;
  try {
    context = await getOrganizationProjectWorkspace(gate.session.userId, projectId);
  } catch {
    notFound();
  }
  const definition = projectEnvironments.find((item)=>item.id===requested);
  if (!definition || !canOpenProjectEnvironment(definition, context.permissions)) notFound();
  return <ProjectWorkspaceShell environment={requested} {...context}/>;
}
