const NOTION_VERSION = "2025-09-03";
const PUBLIC_PROFILE_PAGE_SIZE = 50;
const MAX_PUBLIC_DIRECTORY_PAGES = 10;

type UnknownRecord = Record<string, unknown>;

export interface PublicDirectoryProfile {
  id: string;
  name: string;
  role: string | null;
  division: string | null;
  profileType: string | null;
  bio: string | null;
  verificationStatus: string | null;
  licenseType: string | null;
  licenseAuthority: string | null;
  licenseJurisdiction: string | null;
}

export interface PublicDirectoryResult {
  configured: boolean;
  profiles: PublicDirectoryProfile[];
  status: "ready" | "not_configured" | "provider_error";
}

interface DirectoryEnvironment {
  NOTION_API_TOKEN?: string;
  NOTION_PERSONNEL_DATA_SOURCE_ID?: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function prop(properties: unknown, name: string): UnknownRecord | null {
  const values = asRecord(properties);
  return asRecord(values?.[name]);
}

function textValue(value: unknown): string | null {
  const item = asRecord(value);
  if (!item) return null;

  for (const key of ["title", "rich_text"]) {
    const parts = item[key];
    if (!Array.isArray(parts)) continue;
    const text = parts
      .map((part) => {
        const entry = asRecord(part);
        const plain = entry?.plain_text;
        if (typeof plain === "string") return plain;
        const textObject = asRecord(entry?.text);
        return typeof textObject?.content === "string" ? textObject.content : "";
      })
      .join("")
      .trim();
    if (text) return text;
  }
  return null;
}

function labelValue(value: unknown): string | null {
  const item = asRecord(value);
  if (!item) return null;
  for (const key of ["select", "status"]) {
    const selected = asRecord(item[key]);
    if (typeof selected?.name === "string" && selected.name.trim()) return selected.name.trim();
  }
  return textValue(item);
}

function audienceValues(value: unknown): string[] {
  const item = asRecord(value);
  if (!item) return [];
  // The authoritative GEM registry has a multi_select Audience property, not a select.
  if (!Array.isArray(item.multi_select)) return [];
  return item.multi_select
    .map((v) => asRecord(v)?.name)
    .filter((v): v is string => typeof v === "string");
}

function dateValue(value: unknown): string | null {
  const item = asRecord(value);
  const date = asRecord(item?.date);
  return typeof date?.start === "string" ? date.start : null;
}

function normalized(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function isUnexpired(value: unknown, now: Date): boolean {
  const date = asRecord(asRecord(value)?.date);
  const expires = typeof date?.end === "string" ? date.end : dateValue(value);
  if (!expires) return true;
  // A date-only expiry remains valid through its stated calendar date (UTC).
  const until = expires.length === 10 ? `${expires}T23:59:59.999Z` : expires;
  const timestamp = Date.parse(until);
  return Number.isFinite(timestamp) && timestamp >= now.getTime();
}

function hasReviewer(value: unknown): boolean {
  const people = asRecord(value)?.people;
  return Array.isArray(people) && people.length > 0;
}

/**
 * Publication is independently gated by the real Notion schema:
 * checkbox, Public visibility, explicit Public-only audience, CEO approval,
 * Verified evidence, reviewer, verification date and non-expired record.
 * No VIP/AI/internal-only records may be displayed by a malformed query.
 */
export function isApprovedPublicDirectoryPage(page: unknown, now = new Date()): boolean {
  const source = asRecord(page);
  if (!source || source.archived === true || source.in_trash === true) return false;
  const p = source.properties;
  if (!p) return false;

  const approved = prop(p, "Publish Approved")?.checkbox === true;
  const visibility = normalized(labelValue(prop(p, "Website Visibility")));
  const audiences = audienceValues(prop(p, "Audience")).map((x) => x.toLowerCase());
  const type = normalized(labelValue(prop(p, "Type")));
  const ceoApproval = normalized(labelValue(prop(p, "CEO Approval")));
  const verified = normalized(labelValue(prop(p, "Verification Status")));
  const reviewer = hasReviewer(prop(p, "Reviewer"));
  const verifiedAt = dateValue(prop(p, "Last Verified"));
  const verificationTime = verifiedAt ? Date.parse(verifiedAt) : NaN;

  return (
    approved &&
    visibility === "public" &&
    audiences.includes("public") &&
    !audiences.some((audience) => ["vip", "client", "internal", "super admin"].includes(audience)) &&
    ["human", "function"].includes(type) &&
    ceoApproval === "approved" &&
    verified === "verified" &&
    reviewer &&
    Number.isFinite(verificationTime) &&
    verificationTime <= now.getTime() &&
    isUnexpired(prop(p, "Expires"), now)
  );
}

export function parsePublicDirectoryPage(page: unknown, now = new Date()): PublicDirectoryProfile | null {
  if (!isApprovedPublicDirectoryPage(page, now)) return null;

  const source = asRecord(page);
  const properties = source?.properties;
  const name =
    textValue(prop(properties, "Profile / Function")) ??
    textValue(prop(properties, "Name"));

  if (!name) return null;
  const licenseVisibility = normalized(labelValue(prop(properties, "Public License Display")));
  const allowLicense = licenseVisibility === "verified";

  return {
    id: typeof source?.id === "string" ? source.id : name,
    name,
    role: textValue(prop(properties, "Role")) ?? labelValue(prop(properties, "Role")),
    division: textValue(prop(properties, "Division")) ?? labelValue(prop(properties, "Division")),
    profileType: labelValue(prop(properties, "Type")),
    bio: textValue(prop(properties, "Public Bio")),
    verificationStatus: labelValue(prop(properties, "Verification Status")),
    licenseType: allowLicense ? textValue(prop(properties, "License Type")) : null,
    licenseAuthority: allowLicense ? textValue(prop(properties, "Licensing Authority")) : null,
    licenseJurisdiction: allowLicense ? textValue(prop(properties, "License Jurisdiction")) : null,
  };
}

function normalizeDataSourceId(value: string | undefined): string | null {
  const candidate = value?.trim().replace(/^collection:\/\//, "") ?? "";
  return /^[a-f0-9-]{32,36}$/i.test(candidate) ? candidate : null;
}

export async function getPublicDirectory(
  env: DirectoryEnvironment = {
    NOTION_API_TOKEN: process.env.NOTION_API_TOKEN,
    NOTION_PERSONNEL_DATA_SOURCE_ID: process.env.NOTION_PERSONNEL_DATA_SOURCE_ID,
  },
  request: typeof fetch = fetch,
): Promise<PublicDirectoryResult> {
  const token = env.NOTION_API_TOKEN?.trim();
  const dataSourceId = normalizeDataSourceId(env.NOTION_PERSONNEL_DATA_SOURCE_ID);
  if (!token || !dataSourceId) {
    return { configured: false, profiles: [], status: "not_configured" };
  }

  try {
    const results: unknown[] = [];
    let cursor: string | undefined;
    let complete = false;
    for (let page = 0; page < MAX_PUBLIC_DIRECTORY_PAGES; page += 1) {
      const response = await request(
        `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
          },
          body: JSON.stringify({
            page_size: PUBLIC_PROFILE_PAGE_SIZE,
            ...(cursor ? { start_cursor: cursor } : {}),
            filter: {
              and: [
                { property: "Publish Approved", checkbox: { equals: true } },
                { property: "Website Visibility", select: { equals: "Public" } },
                { property: "CEO Approval", select: { equals: "Approved" } },
                { property: "Verification Status", select: { equals: "Verified" } },
                { property: "Audience", multi_select: { contains: "Public" } },
              ],
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) {
        return { configured: true, profiles: [], status: "provider_error" };
      }

      const payload = asRecord(await response.json());
      if (!payload || !Array.isArray(payload.results)) {
        return { configured: true, profiles: [], status: "provider_error" };
      }
      results.push(...payload.results);
      if (payload.has_more !== true) {
        complete = true;
        break;
      }
      if (typeof payload.next_cursor !== "string" || !payload.next_cursor) {
        return { configured: true, profiles: [], status: "provider_error" };
      }
      cursor = payload.next_cursor;
    }
    if (!complete) return { configured: true, profiles: [], status: "provider_error" };

    const profiles = results
      .map((item) => parsePublicDirectoryPage(item))
      .filter((item): item is PublicDirectoryProfile => item !== null);
    return { configured: true, profiles, status: "ready" };
  } catch {
    return { configured: true, profiles: [], status: "provider_error" };
  }
}
