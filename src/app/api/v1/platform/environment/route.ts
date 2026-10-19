import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { platformEnvironment } from "@/lib/platformEnvironment";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    environment: platformEnvironment,
  });
}

export async function PATCH() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "Environment updates require an explicit implementation backed by persisted configuration and secret management.",
      environment: platformEnvironment,
    },
    { status: 501 },
  );
}
