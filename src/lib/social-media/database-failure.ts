import { TokMetricError } from "@/lib/tokmetric/security";

const knownCodes = new Set(["P1000", "P1001", "P1002", "P1008", "P1010", "P1011", "P1012", "P1013", "P1017", "P2021", "P2022"]);

/** Return only a fixed diagnostic identifier; Prisma messages can contain credentials. */
export function connectorDatabaseFailure(error: unknown): TokMetricError {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const candidate = record.code ?? record.errorCode;
  const code = typeof candidate === "string" && knownCodes.has(candidate) ? candidate : "UNAVAILABLE";
  return new TokMetricError(503, `SOCIAL_CONNECTOR_DATABASE_${code}`, "The social account database connection could not be verified. No account connection was changed.");
}
