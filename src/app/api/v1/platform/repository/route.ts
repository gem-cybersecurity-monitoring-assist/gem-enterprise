import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { repositoryConnection } from "@/lib/platformEnvironment";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ repository: repositoryConnection });
}

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
      error: "Repository connection changes must be performed through the connected GitHub/Vercel integration flow.",
      repository: repositoryConnection,
    },
    { status: 501 },
  );
}
