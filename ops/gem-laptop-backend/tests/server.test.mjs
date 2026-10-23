import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createApp, createConfig, normalizeAction, tokenMatches } from '../src/server.mjs';

async function withServer(run) {
  const root = await mkdtemp(join(tmpdir(), 'gem-laptop-backend-'));
  const requestDir = join(root, 'requests');
  await mkdir(requestDir, { recursive: true });
  await writeFile(join(root, 'auth-token.txt'), 'x'.repeat(64));
  await writeFile(join(root, 'status.json'), JSON.stringify({
    continuityVersion: '3.2.0-alpha.1',
    coreVersion: '2.3.1',
    agentUser: 'GEM-ASSIST\\GEM ASSIST',
    backendHealthy: false,
    pipelineReady: false,
    obsRunning: false,
    obsWebSocket: false,
    pinokioRunning: false,
    sessionEnabled: false,
    lastAction: 'agent-started',
    startupGraceSeconds: 300,
    updatedAt: new Date().toISOString(),
  }));

  const config = createConfig({
    GEM_LAPTOP_ROOT: root,
    GEM_LAPTOP_REQUEST_DIR: requestDir,
    GEM_LAPTOP_STATUS_FILE: join(root, 'status.json'),
    GEM_LAPTOP_TOKEN_FILE: join(root, 'auth-token.txt'),
    GEM_LAPTOP_AUDIT_FILE: join(root, 'audit.jsonl'),
    GEM_LAPTOP_DASHBOARD_FILE: join(root, 'missing-dashboard.html'),
  });

  const server = createServer((request, response) => {
    createApp(config)(request, response).catch((error) => {
      response.statusCode = 500;
      response.end(error.message);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`, root);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('normalizes only fixed allowed actions', () => {
  assert.equal(normalizeAction(' START '), 'start');
  assert.equal(normalizeAction('doctor'), 'doctor');
  assert.equal(normalizeAction('powershell'), null);
  assert.equal(normalizeAction('../start'), null);
});

test('compares tokens without accepting mismatched lengths', () => {
  assert.equal(tokenMatches('a'.repeat(32), 'a'.repeat(32)), true);
  assert.equal(tokenMatches('a'.repeat(32), 'b'.repeat(32)), false);
  assert.equal(tokenMatches('a'.repeat(32), 'a'.repeat(31)), false);
});

test('health is redacted and available without the bearer token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.service, 'gem-laptop-backend');
    assert.equal(payload.authConfigured, true);
    assert.equal('agentUser' in payload, false);
  });
});

test('status requires the bearer token', async () => {
  await withServer(async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/status`);
    assert.equal(denied.status, 401);

    const accepted = await fetch(`${baseUrl}/api/status`, {
      headers: { Authorization: `Bearer ${'x'.repeat(64)}` },
    });
    assert.equal(accepted.status, 200);
    const payload = await accepted.json();
    assert.equal(payload.startupGraceSeconds, 300);
  });
});

test('command endpoint creates only an allowlisted request file', async () => {
  await withServer(async (baseUrl, root) => {
    const accepted = await fetch(`${baseUrl}/api/commands/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${'x'.repeat(64)}` },
    });
    assert.equal(accepted.status, 202);

    const request = JSON.parse(await (await import('node:fs/promises')).readFile(join(root, 'requests', 'start.request'), 'utf8'));
    assert.equal(request.action, 'start');

    const denied = await fetch(`${baseUrl}/api/commands/powershell`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${'x'.repeat(64)}` },
    });
    assert.equal(denied.status, 404);
  });
});
