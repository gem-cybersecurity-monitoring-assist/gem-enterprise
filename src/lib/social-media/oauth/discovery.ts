import { TokMetricError } from "@/lib/tokmetric/security";
import type { SocialOAuthProviderConfig } from "./config";
import type { StoredSocialCredential } from "./store";

const DISCOVERY_TIMEOUT_MS = 15_000;
const MAX_DISCOVERED_ACCOUNTS = 100;
const MAX_DISCOVERY_PAGES = 20;
const LINKEDIN_PUBLISH_ROLES = new Set([
  "ADMINISTRATOR",
  "CONTENT_ADMINISTRATOR",
  "DIRECT_SPONSORED_CONTENT_POSTER",
  "RECRUITING_POSTER",
]);

type JsonRecord = Record<string, unknown>;

export interface DiscoveredSocialAccount {
  externalAccountId: string;
  displayName: string;
  accountType: string;
  username?: string;
  safeMetadata: Record<string, unknown>;
  credential: StoredSocialCredential;
}

function object(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

function accountCredential(
  credential: StoredSocialCredential,
  externalAccountId: string,
  accessToken?: string,
): StoredSocialCredential {
  if (accessToken) {
    return {
      provider: credential.provider,
      accessToken,
      tokenType: credential.tokenType,
      grantedScopes: credential.grantedScopes,
      externalAccountId,
    };
  }
  return {
    ...credential,
    externalAccountId,
  };
}

function paginationCandidate(payload: unknown) {
  const root = object(payload);
  const containers = [root, object(root?.paging), object(root?.pagination)];
  for (const container of containers) {
    const direct = stringValue(container?.next);
    if (direct) return direct;
    const links = Array.isArray(container?.links) ? container.links : [];
    for (const entry of links) {
      const link = object(entry);
      if (stringValue(link?.rel)?.toLowerCase() !== "next") continue;
      const href = stringValue(link?.href) || stringValue(link?.url);
      if (href) return href;
    }
  }
  return undefined;
}

function safePaginationUrl(
  config: SocialOAuthProviderConfig,
  currentUrl: URL,
  candidate?: string,
) {
  if (!candidate) return undefined;
  let nextUrl: URL;
  try {
    nextUrl = new URL(candidate, currentUrl);
  } catch {
    throw new TokMetricError(
      502,
      "SOCIAL_ACCOUNT_DISCOVERY_PAGINATION_INVALID",
      `${config.displayName} returned an invalid account pagination link.`,
    );
  }
  const configuredOrigin = new URL(config.accountDiscoveryUrl).origin;
  if (nextUrl.protocol !== "https:" || nextUrl.origin !== configuredOrigin) {
    throw new TokMetricError(
      502,
      "SOCIAL_ACCOUNT_DISCOVERY_PAGINATION_INVALID",
      `${config.displayName} returned an untrusted account pagination link.`,
    );
  }
  return nextUrl;
}

async function fetchDiscoveryJson(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
  url: URL,
  headers?: Record<string, string>,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credential.accessToken}`,
        ...headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
  } catch {
    throw new TokMetricError(
      502,
      "SOCIAL_ACCOUNT_DISCOVERY_UNAVAILABLE",
      `${config.displayName} account discovery is unavailable.`,
    );
  }

  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (response.status === 401 || response.status === 403) {
    throw new TokMetricError(
      401,
      "SOCIAL_ACCOUNT_DISCOVERY_UNAUTHORIZED",
      `${config.displayName} did not permit account discovery.`,
    );
  }
  if (response.status === 429) {
    throw new TokMetricError(
      503,
      "SOCIAL_ACCOUNT_DISCOVERY_RATE_LIMITED",
      `${config.displayName} account discovery is temporarily rate limited.`,
    );
  }
  if (!response.ok) {
    throw new TokMetricError(
      502,
      "SOCIAL_ACCOUNT_DISCOVERY_FAILED",
      `${config.displayName} did not return an authorized account inventory.`,
    );
  }
  return payload;
}

function mapMetaPage(
  entry: unknown,
  credential: StoredSocialCredential,
): DiscoveredSocialAccount[] {
  const page = object(entry);
  const id = stringValue(page?.id);
  const name = stringValue(page?.name);
  const pageAccessToken = stringValue(page?.access_token);
  if (!id || !name || !pageAccessToken) return [];
  const instagram = object(page?.instagram_business_account);
  const instagramId = stringValue(instagram?.id);
  const instagramUsername = stringValue(instagram?.username);
  return [
    {
      externalAccountId: id,
      displayName: name,
      accountType: "META_PAGE",
      safeMetadata: {
        facebookPageId: id,
        tasks: stringList(page?.tasks),
        instagramBusinessAccountId: instagramId || null,
        instagramUsername: instagramUsername || null,
        linkedInstagramAccountPresent: Boolean(instagramId),
      },
      credential: accountCredential(credential, id, pageAccessToken),
    },
  ];
}

async function discoverMetaAccounts(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): Promise<DiscoveredSocialAccount[]> {
  let nextUrl: URL | undefined = new URL(config.accountDiscoveryUrl);
  nextUrl.searchParams.set(
    "fields",
    "id,name,access_token,tasks,instagram_business_account{id,username,name}",
  );
  nextUrl.searchParams.set("limit", "100");
  const accounts: DiscoveredSocialAccount[] = [];
  const seenUrls = new Set<string>();

  for (
    let pageIndex = 0;
    nextUrl && pageIndex < MAX_DISCOVERY_PAGES && accounts.length < MAX_DISCOVERED_ACCOUNTS;
    pageIndex += 1
  ) {
    if (seenUrls.has(nextUrl.toString())) break;
    seenUrls.add(nextUrl.toString());
    const currentUrl = nextUrl;
    const payload = object(await fetchDiscoveryJson(config, credential, currentUrl));
    const pages = Array.isArray(payload?.data) ? payload.data : [];
    accounts.push(...pages.flatMap((entry) => mapMetaPage(entry, credential)));
    nextUrl = safePaginationUrl(config, currentUrl, paginationCandidate(payload));
  }

  return accounts;
}

async function discoverXAccount(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): Promise<DiscoveredSocialAccount[]> {
  const url = new URL(config.accountDiscoveryUrl);
  url.searchParams.set("user.fields", "username,name,verified,protected,profile_image_url");
  const payload = object(await fetchDiscoveryJson(config, credential, url));
  const data = object(payload?.data);
  const id = stringValue(data?.id);
  const displayName = stringValue(data?.name);
  if (!id || !displayName) return [];
  const username = stringValue(data?.username);
  return [
    {
      externalAccountId: id,
      displayName,
      accountType: "X_USER",
      username,
      safeMetadata: {
        username: username || null,
        verified: typeof data?.verified === "boolean" ? data.verified : null,
        protected: typeof data?.protected === "boolean" ? data.protected : null,
      },
      credential: accountCredential(credential, id),
    },
  ];
}

function mapLinkedInAcl(
  entry: unknown,
  credential: StoredSocialCredential,
): DiscoveredSocialAccount[] {
  const acl = object(entry);
  const state = stringValue(acl?.state);
  const organizationTarget =
    stringValue(acl?.organizationTarget) || stringValue(acl?.organization);
  if (!organizationTarget || state !== "APPROVED") return [];
  const organizationId = organizationTarget.split(":").at(-1)?.trim();
  if (!organizationId) return [];
  const role = stringValue(acl?.role);
  return [
    {
      externalAccountId: organizationId,
      displayName: `LinkedIn organization ${organizationId}`,
      accountType: "LINKEDIN_ORGANIZATION",
      safeMetadata: {
        organizationUrn: organizationTarget,
        approvedRole: role || null,
        roleState: state,
        publishRoleEligible: role ? LINKEDIN_PUBLISH_ROLES.has(role) : false,
      },
      credential: accountCredential(credential, organizationId),
    },
  ];
}

async function discoverLinkedInOrganizations(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): Promise<DiscoveredSocialAccount[]> {
  let nextUrl: URL | undefined = new URL(config.accountDiscoveryUrl);
  nextUrl.searchParams.set("q", "roleAssignee");
  nextUrl.searchParams.set("count", "100");
  const accounts: DiscoveredSocialAccount[] = [];
  const seenUrls = new Set<string>();
  const headers = {
    "LinkedIn-Version": config.apiVersion || "",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  for (
    let pageIndex = 0;
    nextUrl && pageIndex < MAX_DISCOVERY_PAGES && accounts.length < MAX_DISCOVERED_ACCOUNTS;
    pageIndex += 1
  ) {
    if (seenUrls.has(nextUrl.toString())) break;
    seenUrls.add(nextUrl.toString());
    const currentUrl = nextUrl;
    const payload = object(await fetchDiscoveryJson(config, credential, currentUrl, headers));
    const elements = Array.isArray(payload?.elements) ? payload.elements : [];
    accounts.push(...elements.flatMap((entry) => mapLinkedInAcl(entry, credential)));

    const explicitNext = paginationCandidate(payload);
    if (explicitNext) {
      nextUrl = safePaginationUrl(config, currentUrl, explicitNext);
      continue;
    }
    const paging = object(payload?.paging);
    const start = numberValue(paging?.start);
    const count = numberValue(paging?.count);
    const total = numberValue(paging?.total);
    if (start !== undefined && count && total !== undefined && start + count < total) {
      nextUrl = new URL(currentUrl);
      nextUrl.searchParams.set("start", String(start + count));
      nextUrl.searchParams.set("count", String(Math.min(count, 100)));
    } else {
      nextUrl = undefined;
    }
  }

  return accounts;
}

function mapYouTubeChannel(
  entry: unknown,
  credential: StoredSocialCredential,
): DiscoveredSocialAccount[] {
  const channel = object(entry);
  const id = stringValue(channel?.id);
  const snippet = object(channel?.snippet);
  const status = object(channel?.status);
  const title = stringValue(snippet?.title);
  if (!id || !title) return [];
  return [
    {
      externalAccountId: id,
      displayName: title,
      accountType: "YOUTUBE_CHANNEL",
      username: stringValue(snippet?.customUrl),
      safeMetadata: {
        customUrl: stringValue(snippet?.customUrl) || null,
        privacyStatus: stringValue(status?.privacyStatus) || null,
        madeForKids: typeof status?.madeForKids === "boolean" ? status.madeForKids : null,
      },
      credential: accountCredential(credential, id),
    },
  ];
}

async function discoverYouTubeChannels(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): Promise<DiscoveredSocialAccount[]> {
  const baseUrl = new URL(config.accountDiscoveryUrl);
  baseUrl.searchParams.set("part", "id,snippet,status");
  baseUrl.searchParams.set("mine", "true");
  baseUrl.searchParams.set("maxResults", "50");
  const accounts: DiscoveredSocialAccount[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  for (
    let pageIndex = 0;
    pageIndex < MAX_DISCOVERY_PAGES && accounts.length < MAX_DISCOVERED_ACCOUNTS;
    pageIndex += 1
  ) {
    const url = new URL(baseUrl);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const payload = object(await fetchDiscoveryJson(config, credential, url));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    accounts.push(...items.flatMap((entry) => mapYouTubeChannel(entry, credential)));
    const nextPageToken = stringValue(payload?.nextPageToken);
    if (!nextPageToken || seenTokens.has(nextPageToken)) break;
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  return accounts;
}

function nextdoorProfiles(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const root = object(payload);
  for (const key of ["profiles", "data", "results"]) {
    if (Array.isArray(root?.[key])) return root[key] as unknown[];
  }
  return [];
}

function mapNextdoorProfile(
  entry: unknown,
  credential: StoredSocialCredential,
): DiscoveredSocialAccount[] {
  const profile = object(entry);
  const entityPage = object(profile?.entity_page);
  const id = stringValue(profile?.id) || stringValue(entityPage?.id);
  const displayName =
    stringValue(entityPage?.name) ||
    stringValue(profile?.business_name) ||
    stringValue(profile?.name);
  if (!id || !displayName) return [];
  const entityProfile = profile?.is_entity_profile === true || Boolean(entityPage);
  return [
    {
      externalAccountId: id,
      displayName,
      accountType: entityProfile ? "NEXTDOOR_ENTITY_PROFILE" : "NEXTDOOR_PROFILE",
      safeMetadata: {
        secureProfileId: id,
        entityProfile,
        entityPageId: stringValue(entityPage?.id) || null,
        publicationUrl: stringValue(entityPage?.publication_url) || null,
        verified: typeof profile?.verified === "boolean" ? profile.verified : null,
      },
      credential: accountCredential(credential, id),
    },
  ];
}

async function discoverNextdoorProfiles(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): Promise<DiscoveredSocialAccount[]> {
  let nextUrl: URL | undefined = new URL(config.accountDiscoveryUrl);
  const accounts: DiscoveredSocialAccount[] = [];
  const seenUrls = new Set<string>();

  for (
    let pageIndex = 0;
    nextUrl && pageIndex < MAX_DISCOVERY_PAGES && accounts.length < MAX_DISCOVERED_ACCOUNTS;
    pageIndex += 1
  ) {
    if (seenUrls.has(nextUrl.toString())) break;
    seenUrls.add(nextUrl.toString());
    const currentUrl = nextUrl;
    const payload = await fetchDiscoveryJson(config, credential, currentUrl);
    accounts.push(
      ...nextdoorProfiles(payload).flatMap((entry) => mapNextdoorProfile(entry, credential)),
    );
    nextUrl = safePaginationUrl(config, currentUrl, paginationCandidate(payload));
  }

  return accounts;
}

function deduplicateAccounts(accounts: DiscoveredSocialAccount[]) {
  const unique = new Map<string, DiscoveredSocialAccount>();
  for (const account of accounts) {
    if (!unique.has(account.externalAccountId)) unique.set(account.externalAccountId, account);
  }
  return [...unique.values()]
    .sort((left, right) => left.externalAccountId.localeCompare(right.externalAccountId))
    .slice(0, MAX_DISCOVERED_ACCOUNTS);
}

export async function discoverSocialAccounts(input: {
  config: SocialOAuthProviderConfig;
  credential: StoredSocialCredential;
}) {
  const { config, credential } = input;
  let accounts: DiscoveredSocialAccount[];
  switch (config.provider) {
    case "META":
      accounts = await discoverMetaAccounts(config, credential);
      break;
    case "X":
      accounts = await discoverXAccount(config, credential);
      break;
    case "LINKEDIN":
      accounts = await discoverLinkedInOrganizations(config, credential);
      break;
    case "YOUTUBE":
      accounts = await discoverYouTubeChannels(config, credential);
      break;
    case "NEXTDOOR":
      accounts = await discoverNextdoorProfiles(config, credential);
      break;
  }

  const discovered = deduplicateAccounts(accounts);
  if (discovered.length === 0) {
    throw new TokMetricError(
      422,
      "SOCIAL_ACCOUNT_DISCOVERY_EMPTY",
      `${config.displayName} authorization did not expose an eligible managed account.`,
    );
  }
  return discovered;
}
