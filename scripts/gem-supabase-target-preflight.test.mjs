import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTarget, managementReadProbe, GEM_PRODUCTION_REF, GEM_MANAGEMENT_ENDPOINT } from './gem-supabase-target-preflight.mjs';

const gateway = `const DEFAULT_GATEWAY_BASE_URL = "https://${GEM_PRODUCTION_REF}.supabase.co/functions/v1";`;

test('identifies mislinked CLI target and legacy environment without substituting them', () => {
  const result = inspectTarget({ config: 'project_id = "zplnwkgxkovepqplhohx"', gateway,
    legacyUrl: 'https://kcurngdalxcjcqucylyy.supabase.co', tokenPresent: false });
  assert.equal(result.cliMatchesProduction, false);
  assert.equal(result.gatewayMatchesProduction, true);
  assert.equal(result.environmentUsesLegacy, true);
  assert.equal(result.managementTokenConfigured, false);
});

test('only the correct production CLI target passes the configuration check', () => {
  const result = inspectTarget({ config: `project_id = "${GEM_PRODUCTION_REF}"`, gateway });
  assert.equal(result.cliMatchesProduction, true);
  assert.equal(result.gatewayMatchesProduction, true);
});

test('management probe is strictly read-only and does not output secrets', async () => {
  const token = 'fake-test-token-value';
  let invoked = false;
  const status = await managementReadProbe(token, async (url, options) => {
    invoked = true;
    assert.equal(url, GEM_MANAGEMENT_ENDPOINT);
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    return { status: 200 };
  });
  assert.equal(invoked, true);
  assert.equal(status, 'PROJECT_READ_ACCESS_CONFIRMED');
});

test('missing token and 403/404 do not establish project access', async () => {
  assert.equal(await managementReadProbe(undefined), 'TOKEN_NOT_CONFIGURED');
  for (const code of [403, 404]) {
    assert.equal(await managementReadProbe('test-only', async () => ({ status: code })), 'PROJECT_PERMISSION_NOT_CONFIRMED');
  }
});
