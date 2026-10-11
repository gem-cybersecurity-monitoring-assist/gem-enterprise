import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bootstrapGatewayStatus, shouldUseSupabaseGateway } from "@/lib/supabase-gateway";

export async function GET() {
  let databaseStatus: "healthy" | "error" = "healthy";
  const databaseBackend = shouldUseSupabaseGateway() ? "supabase_gateway" : "prisma";
  try {
    if (databaseBackend === "supabase_gateway") {
      const result = await bootstrapGatewayStatus<{ configured: boolean }>();
      if (result.configured !== true) throw new Error("Gateway administrator is not configured");
    } else {
      await db.$queryRaw`SELECT 1`;
    }
  } catch {
    databaseStatus = "error";
  }
  const healthy = databaseStatus === "healthy";
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checkedAt: new Date().toISOString(),
      databaseBackend,
      verificationScope: {
        checked: databaseBackend === "supabase_gateway"
          ? "gateway_bootstrap"
          : "direct_database_connection",
        checkedSuccessfully: healthy,
        transactionalWorkflowsTested: false,
        providerPublishingTested: false,
        explanation: databaseBackend === "supabase_gateway"
          ? "Gateway bootstrap is reachable; this does not verify Prisma-backed workflows, publisher transactions, or provider authorization."
          : "A direct database SELECT 1 confirms connectivity only; workflow reads, writes, and provider transactions have not been exercised.",
      },
      services: [
        { name: "application", status: "healthy" },
        { name: "api", status: "healthy" },
        { name: "operations-registry", status: "healthy" },
        { name: "database", status: databaseStatus },
      ],
    },
    { status: healthy ? 200 : 503 },
  );
}
