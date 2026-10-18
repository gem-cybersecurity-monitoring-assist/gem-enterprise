import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deploymentPlan } from "@/lib/platformEnvironment";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ deploymentPlan });
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
      error: "Deployment plan creation should be persisted and reviewed before production deployment actions are enabled.",
      deploymentPlan,
    },
    { status: 501 },
  );
}
