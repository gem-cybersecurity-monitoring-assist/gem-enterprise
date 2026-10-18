import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  let databaseStatus: "healthy" | "error" = "healthy";

  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "error";
  }

  const healthy = databaseStatus === "healthy";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checkedAt: new Date().toISOString(),
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
