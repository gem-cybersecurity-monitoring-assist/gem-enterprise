import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { repositoryConnection } from "@/lib/platformEnvironment";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      syncId: `sync-${Date.now()}`,
      status: "queued",
      message: "Repository metadata sync is delegated to the connected GitHub/Vercel tooling. No write operation was performed by this endpoint.",
      repository: repositoryConnection,
    },
    { status: 202 },
  );
}
