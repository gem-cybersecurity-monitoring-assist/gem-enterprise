import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
const ADMIN_ROLES = ["admin", "super_admin", "internal"];
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!session.organizationId) return NextResponse.json({ error: "Your admin account is not assigned to an organization. Assign its organization before inviting team members." }, { status: 409 });
  const users = await db.user.findMany({
    where: { organizationId: session.organizationId, isActive: true, status: "active", id: { not: session.userId } },
    select: { id: true, email: true, role: true, profile: { select: { firstName: true, lastName: true, displayName: true } } },
    orderBy: { email: "asc" }, take: 500,
  });
  return NextResponse.json({ recipients: users.map(user => ({ id: user.id, email: user.email, role: user.role, name: user.profile?.displayName || [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || user.email })) });
}
