export const serviceRequestTypeCatalog = [
  {
    id: "portfolio_review",
    label: "Portfolio Review",
    description: "Request a review of reporting, allocations, exposure, or protected assets.",
  },
  {
    id: "compliance_review",
    label: "Compliance Review",
    description:
      "Request clarification about compliance status, disclosures, or next steps without submitting identity-document details.",
  },
  {
    id: "cyber_briefing",
    label: "Cyber Briefing",
    description:
      "Request a security briefing or an operational review without including passwords, tokens, recovery codes, or private keys.",
  },
  {
    id: "real_estate_trust",
    label: "ATR Property Trust",
    description: "Request property-trust readiness review or advisor consultation.",
  },
  {
    id: "document_request",
    label: "Document Request",
    description:
      "Request the availability of statements, agreements, or compliance records without entering document numbers or uploading files.",
  },
  {
    id: "support",
    label: "Support",
    description:
      "Request general client service or operational support. This form is not an emergency channel.",
  },
] as const;

export const serviceRequestTypeIds = [
  "portfolio_review",
  "compliance_review",
  "cyber_briefing",
  "real_estate_trust",
  "document_request",
  "support",
] as const;

export const serviceRequestPriorityIds = ["low", "medium", "high"] as const;

export type ServiceRequestTypeId = (typeof serviceRequestTypeIds)[number];
export type ServiceRequestPriorityId = (typeof serviceRequestPriorityIds)[number];

export type SensitiveContentCategory =
  | "credential"
  | "private_key"
  | "recovery_material"
  | "payment_card"
  | "banking_identifier"
  | "identity_identifier";

export interface SensitiveContentInspection {
  safe: boolean;
  categories: SensitiveContentCategory[];
}

function uniqueCategories(categories: SensitiveContentCategory[]) {
  return [...new Set(categories)];
}

function hasLuhnValidNumber(value: string): boolean {
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return candidates.some((candidate) => {
    const digits = String(candidate).replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;

    let sum = 0;
    let doubleDigit = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
      let digit = Number(digits[index]);
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum % 10 === 0;
  });
}

export function inspectServiceRequestContent(value: string): SensitiveContentInspection {
  const source = value.normalize("NFKC");
  const categories: SensitiveContentCategory[] = [];

  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(source)) {
    categories.push("private_key");
  }

  if (
    /\b(?:password|passcode|pin|otp|one[- ]time password|api key|access token|refresh token|client secret|secret key)\s*(?:is|:|=)\s*\S{4,}/i.test(
      source,
    )
  ) {
    categories.push("credential");
  }

  if (
    /\b(?:seed phrase|mnemonic|recovery phrase|recovery code|backup code|private key)\s*(?:is|:|=)\s*(?:\S+\s+){3,}\S+/i.test(
      source,
    )
  ) {
    categories.push("recovery_material");
  }

  if (hasLuhnValidNumber(source)) {
    categories.push("payment_card");
  }

  if (
    /\b(?:bank account|account number|routing number|sort code|iban|swift|bvn)\s*(?:is|:|=)\s*[A-Z0-9 -]{4,}/i.test(
      source,
    )
  ) {
    categories.push("banking_identifier");
  }

  if (
    /\b(?:ssn|social security number|passport number|driver'?s licen[cs]e number|national id|national identification number|nin)\s*(?:is|:|=)\s*[A-Z0-9 -]{4,}/i.test(
      source,
    )
  ) {
    categories.push("identity_identifier");
  }

  const unique = uniqueCategories(categories);
  return { safe: unique.length === 0, categories: unique };
}
