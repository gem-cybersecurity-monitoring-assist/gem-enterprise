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
