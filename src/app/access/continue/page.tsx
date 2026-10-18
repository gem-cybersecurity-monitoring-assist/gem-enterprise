import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getGatewaySessionToken, getSession, resolveAccessDestination } from "@/lib/auth";
import type { SessionPayload, KYCStatus, AuthRole } from "@/lib/auth";
import { resolveWorkspaceAccess } from "@/lib/workspaceAccess";
import { workspaceGateway } from "@/lib/supabase-gateway";

export const dynamic = "force-dynamic";

export default async function AccessContinuePage() {
  const headersList = await headers();

  const userId = headersList.get("x-user-id");
  const kycStatus = headersList.get("x-kyc-status") as KYCStatus | null;
  const userRole = headersList.get("x-user-role") as AuthRole | null;

  if (!userId) {
    redirect("/client-login");
  }

  const session: SessionPayload = (await getSession()) ?? {
    userId,
    email: "",
    role: userRole ?? "client",
    kycStatus: kycStatus ?? "not_started",
    entitlements: [],
  };

  if (session.role !== "client") {
    redirect(resolveAccessDestination(session));
  }

  const gatewayToken = session.authSource === "supabase_gateway" ? await getGatewaySessionToken() : null;
  const workspaceAccess = gatewayToken
    ? await workspaceGateway<{workspaces:Array<{id:string}>}>("access",gatewayToken).then(({workspaces})=>({workspaces,selected:workspaces[0]??null,requestedWorkspaceId:null,requestedDenied:false}))
    : await resolveWorkspaceAccess(userId);

  if (workspaceAccess.workspaces.length > 0) {
    redirect("/app/workspace");
  }

  const destination = resolveAccessDestination(session);
  redirect(destination);

  // This UI renders momentarily before the server redirect executes.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background cyber-grid">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-[hsl(var(--electric-cyan))] border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-mono tracking-wider">
          Validating access…
        </p>
      </div>
    </div>
  );
}
