#!/usr/bin/env node
/**
 * Read-only preflight for the documented GEM Enterprise Supabase target.
 * Never changes projects, secrets, RLS, migrations, or connected providers.
 * The final permission probe uses only the Supabase Management API GET endpoint.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const GEM_PRODUCTION_REF = 'slzdjoqpzbkwzuaexlkj';
export const GEM_LEGACY_REF = 'kcurngdalxcjcqucylyy';
export const GEM_MANAGEMENT_ENDPOINT = `https://api.supabase.com/v1/projects/${GEM_PRODUCTION_REF}`;

export function inspectTarget({ config, gateway, legacyUrl, tokenPresent }) {
  const configured = config.match(/^project_id\s*=\s*"([a-z0-9]+)"/m)?.[1] ?? null;
  const gatewayRef = gateway.match(/https:\/\/([a-z0-9]+)\.supabase\.co\/functions\/v1/)?.[1] ?? null;
  const legacyRef = typeof legacyUrl === 'string'
    ? legacyUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null
    : null;
  return {
    expectedProductionRef: GEM_PRODUCTION_REF,
    configuredCliRef: configured,
    cliMatchesProduction: configured === GEM_PRODUCTION_REF,
    gatewayRef,
    gatewayMatchesProduction: gatewayRef === GEM_PRODUCTION_REF,
    environmentSupabaseRef: legacyRef,
    environmentUsesLegacy: legacyRef === GEM_LEGACY_REF,
    managementTokenConfigured: tokenPresent === true,
  };
}

export async function managementReadProbe(token, request = fetch) {
  if (!token || typeof token !== 'string') return 'TOKEN_NOT_CONFIGURED';
  try {
    const response = await request(GEM_MANAGEMENT_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 200) return 'PROJECT_READ_ACCESS_CONFIRMED';
    if (response.status === 401) return 'TOKEN_UNAUTHORIZED';
    if (response.status === 403 || response.status === 404) return 'PROJECT_PERMISSION_NOT_CONFIRMED';
    return `UNVERIFIED_HTTP_${response.status}`;
  } catch {
    return 'NETWORK_UNAVAILABLE';
  }
}

export async function runPreflight({ root = process.cwd(), env = process.env, log = console.log } = {}) {
  const config = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
  const gateway = await readFile(path.join(root, 'src/lib/supabase-gateway.ts'), 'utf8');
  const state = inspectTarget({
    config,
    gateway,
    legacyUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    tokenPresent: Boolean(env.SUPABASE_ACCESS_TOKEN),
  });
  const authority = await managementReadProbe(env.SUPABASE_ACCESS_TOKEN);
  log(JSON.stringify({ ...state, managementPermission: authority }, null, 2));
  return state.gatewayMatchesProduction && state.cliMatchesProduction && authority === 'PROJECT_READ_ACCESS_CONFIRMED';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const safeToProceed = await runPreflight();
    if (!safeToProceed && !process.argv.includes('--audit')) {
      console.error('SAFE_STOP: GEM Supabase target mismatch or required project permission is unverified. No writes performed.');
      process.exitCode = 2;
    }
  } catch {
    console.error('SAFE_STOP: GEM Supabase target configuration could not be inspected. No writes performed.');
    process.exitCode = 2;
  }
}
