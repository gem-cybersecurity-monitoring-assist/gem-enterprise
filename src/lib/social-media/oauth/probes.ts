import { TokMetricError } from "@/lib/tokmetric/security";
import type { SocialOAuthProviderConfig } from "./config";
import type { StoredSocialCredential } from "./store";

/**
 * Read-only provider probes for the social connector control plane.
 *
 * Every probe is a single HTTP GET against the provider's own account API.
 * Probes never publish, post, or mutate provider-side state.
 */

export const SOCIAL_LIVE_PROBE_TIMEOUT_MS = 10_000;
export const SOCIAL_LIVE_PROBE_TTL_MS = 15 * 60 * 1000;

export interface SocialConnectorProbeResult {
  healthy: boolean;
  latencyMs: number;
  accountName: string | null;
  scopes: string[];
  checkedAt: string;
}

export interface LiveProbeSignal {
  lastProbedAt: string | null;
  probeOk: boolean | null;
  /** "live" when a probe ran within the TTL; "config" is the config-only fallback. */
  source: "live" | "config";
}

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metaGraphBaseUrl(config: SocialOAuthProviderConfig) {
  const base = config.tokenUrl.replace(/\/oauth\/access_token\/?$/, "");
  if (!base || base === config.tokenUrl) {
    throw new TokMetricError(
      503,
      "SOCIAL_PROBE_NOT_CONFIGURED",
      `${config.displayName} probe base URL is not configured.`,
    );
  }
  return base;
}

interface ProbeTarget {
  url: URL;
  headers?: Record<string, string>;
  accountName: (payload: unknown) => string | null;
}

function probeTarget(
  config: SocialOAuthProviderConfig,
  credential: StoredSocialCredential,
): ProbeTarget {
  switch (config.provider) {
    case "META": {
      const url = new URL(`${metaGraphBaseUrl(config)}/me`);
      url.searchParams.set("fields", "id,name");
      return {
        url,
        accountName: (payload) => stringValue(object(payload)?.name) || null,
      };
    }
    case "X": {
      const url = new URL("https://api.x.com/2/users/me");
      url.searchParams.set("user.fields", "name,username");
      return {
        url,
        accountName: (payload) => stringValue(object(object(payload)?.data)?.name) || null,
      };
    }
    case "LINKEDIN": {
      const url = new URL(config.accountDiscoveryUrl);
      url.searchParams.set("q", "roleAssignee");
      url.searchParams.set("count", "1");
      return {
        url,
        headers: {
          "LinkedIn-Version": config.apiVersion || "",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        accountName: () => credential.externalAccountId || null,
      };
    }
    case "YOUTUBE": {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("part", "id,snippet");
      url.searchParams.set("mine", "true");
      url.searchParams.set("maxResults", "1");
      return {
        url,
        accountName: (payload) => {
          const items = object(payload)?.items;
          const first = Array.isArray(items) ? object(items[0]) : undefined;
          return stringValue(object(first?.snippet)?.title) || null;
        },
      };
    }
    case "NEXTDOOR": {
      const url = new URL(config.accountDiscoveryUrl);
      return {
        url,
        accountName: (payload) => {
          const root = object(payload);
          const lists = [payload, root?.profiles, root?.data, root?.results].filter(Array.isArray);
          const first = object((lists[0] as unknown[])?.[0]);
          const entityPage = object(first?.entity_page);
          return (
            stringValue(entityPage?.name) ||
            stringValue(first?.business_name) ||
            stringValue(first?.name) ||
            null
          );
        },
      };
    }
    case "TIKTOK": {
      const url = new URL(config.accountDiscoveryUrl);
      url.searchParams.set("fields", "open_id,display_name");
      return {
        url,
        accountName: (payload) =>
          stringValue(object(object(object(payload)?.data)?.user)?.display_name) || null,
      };
    }
  }
}

export async function probeSocialConnector(input: {
  config: SocialOAuthProviderConfig;
  credential: StoredSocialCredential;
}): Promise<SocialConnectorProbeResult> {
  const { config, credential } = input;
  const target = probeTarget(config, credential);
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(target.url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credential.accessToken}`,
        ...target.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SOCIAL_LIVE_PROBE_TIMEOUT_MS),
    });
  } catch {
    return {
      healthy: false,
      latencyMs: Date.now() - startedAt,
      accountName: null,
      scopes: [...credential.grantedScopes],
      checkedAt,
    };
  }

  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    return {
      healthy: false,
      latencyMs,
      accountName: null,
      scopes: [...credential.grantedScopes],
      checkedAt,
    };
  }

  return {
    healthy: true,
    latencyMs,
    accountName: target.accountName(payload),
    scopes: [...credential.grantedScopes],
    checkedAt,
  };
}

/** Metadata fragment persisted alongside the connector after a live probe. */
export function buildLiveProbeMetadata(result: SocialConnectorProbeResult) {
  return {
    providerProbePerformed: true,
    liveProbeAt: result.checkedAt,
    liveProbeOk: result.healthy,
    liveProbeAccountName: result.accountName,
    liveProbeLatencyMs: result.latencyMs,
  };
}

export function readLiveProbeSignal(
  safeMetadata: unknown,
  now = Date.now(),
): LiveProbeSignal {
  const meta = object(safeMetadata) || {};
  const lastProbedAt = stringValue(meta.liveProbeAt);
  const probeOk =
    typeof meta.liveProbeOk === "boolean" ? (meta.liveProbeOk as boolean) : null;
  const parsed = lastProbedAt ? Date.parse(lastProbedAt) : Number.NaN;
  const fresh =
    Boolean(lastProbedAt) &&
    Number.isFinite(parsed) &&
    now - (parsed as number) <= SOCIAL_LIVE_PROBE_TTL_MS;
  return {
    lastProbedAt: lastProbedAt || null,
    probeOk: lastProbedAt ? probeOk : null,
    source: fresh ? "live" : "config",
  };
}
