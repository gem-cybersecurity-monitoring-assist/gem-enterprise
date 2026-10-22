import { NextRequest, NextResponse } from "next/server";
import { persistDigitalHubEvent } from "@/lib/digital-hub/backend";
import { getDigitalHubProfile } from "@/lib/digital-hub/ecosystem";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  const profile = getDigitalHubProfile(profileId);

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "PROFILE_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const referer = request.headers.get("referer");
  let sameOrigin = false;
  if (referer) {
    try {
      sameOrigin = new URL(referer).origin === request.nextUrl.origin;
    } catch {
      sameOrigin = false;
    }
  }

  if (sameOrigin) {
    await persistDigitalHubEvent({
      event: "profile_open",
      target: profile.id,
      path: "/digital-hub",
    }).catch((error) => {
      console.error("[digital-hub:profile-open]", error);
    });
  }

  return NextResponse.redirect(profile.href, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
