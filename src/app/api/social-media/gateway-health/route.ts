import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/api/auth-helpers";
import { diagnoseSocialPublishingGateway } from "@/lib/social-media/publishing/gateway-diagnostics";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const gate = await requirePlatformOwner();
    if (!gate.ok) return gate.response;
    const diagnostic = await diagnoseSocialPublishingGateway();
    return NextResponse.json(diagnostic, {
      status: diagnostic.state === "HEALTHY" ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ error: "Gateway diagnostics are unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
