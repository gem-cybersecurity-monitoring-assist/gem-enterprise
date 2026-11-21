import assert from 'node:assert/strict';
import test from 'node:test';
import { certifySocialGateway } from './social-gateway-certification.mjs';

const valid = { anonKey: 'test-anon-key', adapterSecret: 'test-private-secret' };
const response = (status, data) => ({ status, json: async () => data });

function mockGateway(rpcCount = 14) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return requests.length === 1 ? response(401) : response(200, { ok: true, rpcCount });
  };
  return { requests, fetchImpl };
}

test('only the original production Supabase project is eligible', async () => {
  for (const baseUrl of [
    'https://dusqdnebwkoycdtjkhyy.supabase.co',
    'https://zplnwkgxkovepqplhohx.supabase.co',
    'https://slzdjoqpzbkwzuaexlkj.supabase.co.evil.example',
    'http://slzdjoqpzbkwzuaexlkj.supabase.co',
    'https://slzdjoqpzbkwzuaexlkj.supabase.co/other',
  ]) {
    const { requests, fetchImpl } = mockGateway();
    const outcome = await certifySocialGateway({ ...valid, baseUrl, fetchImpl });
    assert.equal(outcome.code, 'ORIGINAL_PROJECT_REF_MISMATCH');
    assert.equal(requests.length, 0);
  }
});

test('missing machine credentials fail closed without network calls', async () => {
  const { requests, fetchImpl } = mockGateway();
  const outcome = await certifySocialGateway({ anonKey: 'public', fetchImpl });
  assert.equal(outcome.certified, false);
  assert.equal(outcome.code, 'CERTIFICATION_CREDENTIALS_UNAVAILABLE');
  assert.equal(requests.length, 0);
});

test('anonymous request must be rejected before the authenticated RPC check', async () => {
  let calls = 0;
  const outcome = await certifySocialGateway({ ...valid, fetchImpl: async () => {
    calls += 1;
    return response(200, { ok: true, rpcCount: 100 });
  } });
  assert.equal(outcome.code, 'ANONYMOUS_ACCESS_NOT_CERTIFIED');
  assert.equal(calls, 1);
});

test('authorized probe must return HTTP 200', async () => {
  let calls = 0;
  const outcome = await certifySocialGateway({ ...valid, fetchImpl: async () => {
    calls += 1;
    return response(calls === 1 ? 401 : 403);
  } });
  assert.equal(outcome.code, 'OWNER_GATEWAY_HEALTH_NOT_CERTIFIED');
  assert.equal(outcome.authenticatedStatus, 403);
});

test('a 13-RPC migration does not meet the required 14-RPC baseline', async () => {
  const { fetchImpl } = mockGateway(13);
  const outcome = await certifySocialGateway({ ...valid, fetchImpl });
  assert.equal(outcome.certified, false);
  assert.equal(outcome.code, 'RPC_HEALTH_BELOW_REQUIRED_BASELINE');
  assert.equal(outcome.rpcCount, 13);
});

test('certifies only a denied anonymous probe plus live authorized >=14 RPC response', async () => {
  const { requests, fetchImpl } = mockGateway(14);
  const outcome = await certifySocialGateway({ ...valid, fetchImpl });
  assert.equal(outcome.certified, true);
  assert.equal(outcome.rpcCount, 14);
  assert.equal(requests.length, 2);
  for (const r of requests) {
    assert.equal(r.url, 'https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1/gem-social-publishing-gateway');
    assert.equal(r.options.method, 'POST');
    assert.deepEqual(JSON.parse(r.options.body), { action: 'health' });
  }
  assert.equal('Authorization' in requests[0].options.headers, false);
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-private-secret');
  assert.equal(JSON.stringify(outcome).includes('test-private-secret'), false);
  assert.equal(JSON.stringify(outcome).includes('test-anon-key'), false);
});

test('unreachable probes remain uncertified without exposing errors', async () => {
  const outcome = await certifySocialGateway({ ...valid, fetchImpl: async () => { throw new Error('secret: xxx'); } });
  assert.deepEqual(Object.keys(outcome).sort(), ['certified', 'code', 'projectRef']);
  assert.equal(outcome.code, 'GATEWAY_PROBE_UNREACHABLE');
});
