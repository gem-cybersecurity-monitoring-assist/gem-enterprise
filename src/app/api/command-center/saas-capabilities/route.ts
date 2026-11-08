import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { saasCapabilityCatalog } from "@/lib/saasCapabilityCatalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  return NextResponse.json(
    { schemaVersion: 1, type: "prelaunch-capability-register", runtimeHealthVerified: false, capabilities: saasCapabilityCatalog },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
