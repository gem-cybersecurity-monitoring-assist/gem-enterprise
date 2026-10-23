import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSafeExperianReadiness } from "@/lib/experian/config";
import { authorizeExperianWorkspace } from "@/lib/experian/security";
import { getExperianConnection } from "@/lib/experian/store";
import {
  correlationId,
  TokMetricError,
  tokMetricErrorResponse,
} from "@/lib/tokmetric/security";

export const dynamic = "force-dynamic";

const querySchema = z.object({ workspaceId: z.string().trim().min(1) });

export async function GET(request: NextRequest) {
  const cid = correlationId(request);
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      throw new TokMetricError(400, "VALIDATION_ERROR", "workspaceId is required.");
    }
    await authorizeExperianWorkspace(request, parsed.data.workspaceId);
    const baseReadiness = getSafeExperianReadiness();
    let connection = null;
    let storeProvisioned = true;
    try {
      connection = await getExperianConnection(parsed.data.workspaceId);
    } catch (error) {
      if (!(error instanceof TokMetricError) || error.code !== "EXPERIAN_STORE_NOT_PROVISIONED") {
        throw error;
      }
      storeProvisioned = false;
    }
    const readiness = {
      ...baseReadiness,
      configured: baseReadiness.configured && storeProvisioned,
      storeProvisioned,
      missing: storeProvisioned
        ? baseReadiness.missing
        : [...baseReadiness.missing, "EXPERIAN_STORE_NOT_PROVISIONED"],
    };
    return NextResponse.json(
      {
        ok: true,
        readiness,
        connection: connection
          ? {
              state: connection.state,
              authMode: connection.authMode,
              environment: connection.environment,
              displayLabel: connection.displayLabel,
              externalAccountReference: connection.externalAccountReference,
              grantedScopes: connection.grantedScopes,
              approvedCapabilities: connection.approvedCapabilities,
              lastReadVerifiedAt: connection.lastReadVerifiedAt,
              lastHealthAt: connection.lastHealthAt,
              updatedAt: connection.updatedAt,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return tokMetricErrorResponse(error, cid);
  }
}
