import { TokMetricError } from "@/lib/tokmetric/security";

const knownCodes = new Set(["P1000", "P1001", "P1002", "P1008", "P1010", "P1011", "P1012", "P1013", "P1017", "P2021", "P2022"]);

/** Return only a fixed diagnostic identifier; Prisma messages can contain credentials. */
export function connectorDatabaseFailure(error: unknown): TokMetricError {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const candidate = record.code ?? record.errorCode;
  const message = typeof record.message === "string" ? record.message : "";
  const name = typeof record.name === "string" ? record.name : "";
  const category = /self[- ]signed|certificate verify|unknown issuer|unable to get local issuer/i.test(message) ? "TLS_CERTIFICATE"
    : /prepared statement.*(already exists|does not exist)/i.test(message) ? "POOLER_STATEMENT"
    : /tenant or user not found/i.test(message) ? "POOLER_IDENTITY"
    : /password authentication failed|SASL authentication/i.test(message) ? "AUTHENTICATION"
    : /PrismaClientValidationError/.test(name) ? "QUERY_VALIDATION"
    : /PrismaClientInitializationError/.test(name) ? "CLIENT_INITIALIZATION"
    : /PrismaClientUnknownRequestError/.test(name) ? "UNKNOWN_QUERY"
    : "UNAVAILABLE";
  const code = typeof candidate === "string" && knownCodes.has(candidate) ? candidate : category;
  return new TokMetricError(503, `SOCIAL_CONNECTOR_DATABASE_${code}`, "The social account database connection could not be verified. No account connection was changed.");
}
