/**
 * Read-only certification for the original GEM Enterprise social-publishing gateway.
 * Never accepts development projects and never invokes publishing actions.
 * Requires credentials supplied securely at execution time; does not log them.
 */
import { pathToFileURL } from 'node:url';

export const ORIGINAL_PROJECT_REF = 'slzdjoqpzbkwzuaexlkj';
export const MINIMUM_RPC_COUNT = 14;
const HOST = \`\${ORIGINAL_PROJECT_REF}.supabase.co\`;
const ACTION = JSON.stringify({ action: 'health' });

function exactOriginalUrl(baseUrl) {
  let url;
  try { url = new URL(baseUrl); } catch { return null; }
  if (
    url.protocol !== 'https:' || url.hostname !== HOST || url.port ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) return null;
  return \`\${url.origin}/functions/v1/gem-social-publishing-gateway\`;
}

function result(code, fields = {}) {
  return { certified: false, projectRef: ORIGINAL_PROJECT_REF, code, ...fields };
}

/** Read-only probes only. No body or secret values are returned or logged. */
export async function certifySocialGateway({
  baseUrl = \`https://\${HOST}\`,
  anonKey,
  adapterSecret,
  fetchImpl = fetch,
  timeoutMs = 10000,
} = {}) {
  const endpoint = exactOriginalUrl(baseUrl);
  if (!endpoint) return result('ORIGINAL_PROJECT_REF_MISMATCH');
  if (!anonKey || !adapterSecret || typeof anonKey !== 'string' || typeof adapterSecret !== 'string') {
    return result('CERTIFICATION_CREDENTIALS_UNAVAILABLE');
  }
  const request = (authorization) => fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      ...(authorization ? { Authorization: \`Bearer \${adapterSecret}\` } : {}),
    },
    body: ACTION,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  try {
    const anonymous = await request(false);
    if (anonymous.status !== 401) {
      return result('ANONYMOUS_ACCESS_NOT_CERTIFIED', { anonymousStatus: anonymous.status });
    }
    const authorized = await request(true);
    if (authorized.status !== 200) {
      return result('OWNER_GATEWAY_HEALTH_NOT_CERTIFIED', {
        anonymousStatus: anonymous.status, authenticatedStatus: authorized.status,
      });
    }
    const data = await authorized.json().catch(() => null);
    const rpcCount = data && Number.isInteger(data.rpcCount) ? data.rpcCount : null;
    if (data?.ok !== true || rpcCount === null || rpcCount < MINIMUM_RPC_COUNT) {
      return result('RPC_HEALTH_BELOW_REQUIRED_BASELINE', {
        anonymousStatus: anonymous.status, authenticatedStatus: authorized.status, rpcCount,
      });
    }
    return {
      certified: true, code: 'ORIGINAL_GATEWAY_HEALTH_VERIFIED', projectRef: ORIGINAL_PROJECT_REF,
      anonymousStatus: anonymous.status, authenticatedStatus: authorized.status, rpcCount,
    };
  } catch {
    return result('GATEWAY_PROBE_UNREACHABLE');
  }
}

// Only execute live probes when directly run. Importing from tests is inert.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outcome = await certifySocialGateway({
    baseUrl: process.env.GEM_GATEWAY_CERT_SUPABASE_URL,
    anonKey: process.env.GEM_GATEWAY_CERT_ANON_KEY,
    adapterSecret: process.env.SOCIAL_GATEWAY_ADAPTER_SECRET,
  });
  console.log(JSON.stringify(outcome));
  if (!outcome.certified) process.exitCode = 1;
}
