import crypto from "node:crypto";
import { TokMetricError } from "@/lib/tokmetric/security";

function encryptionKey() {
  const raw = process.env.EXPERIAN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new TokMetricError(
      503,
      "EXPERIAN_NOT_CONFIGURED",
      "Experian credential encryption is not configured.",
    );
  }
  const decoded = Buffer.from(raw, /^[A-Fa-f0-9]{64}$/.test(raw) ? "hex" : "base64");
  if (decoded.length !== 32) {
    throw new TokMetricError(
      503,
      "EXPERIAN_NOT_CONFIGURED",
      "Experian token encryption key must contain exactly 32 bytes.",
    );
  }
  return decoded;
}

export function encryptExperianCredential(payload: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptExperianCredential<T>(value: string): T {
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new TokMetricError(
      500,
      "EXPERIAN_CREDENTIAL_DECRYPT_FAILED",
      "Stored Experian credential could not be read.",
    );
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    throw new TokMetricError(
      500,
      "EXPERIAN_CREDENTIAL_DECRYPT_FAILED",
      "Stored Experian credential could not be read.",
    );
  }
}

export function createExperianPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, method: "S256" as const };
}

export function createExperianNonce() {
  return crypto.randomBytes(32).toString("base64url");
}

export function opaqueExperianReference(value: string) {
  return crypto.createHmac("sha256", encryptionKey()).update("account:v1:").update(value).digest("hex");
}

export function experianResponseDigest(value: unknown) {
  return crypto
    .createHmac("sha256", encryptionKey())
    .update("response:v1:")
    .update(JSON.stringify(value))
    .digest("hex");
}
