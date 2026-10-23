import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile, appendFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '3.2.0-alpha.1';
const CORE_VERSION = '2.3.1';
const ACTIONS = new Set(['start', 'stop', 'restart', 'open', 'base44', 'doctor', 'sleep']);

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(moduleDir, '..');
const defaultRuntimeRoot = process.platform === 'win32'
  ? join(process.env.ProgramData ?? 'C:\\ProgramData', 'GEM Continuity')
  : join(process.cwd(), '.runtime');

export function createConfig(env = process.env) {
  const root = resolve(env.GEM_LAPTOP_ROOT || defaultRuntimeRoot);
  return Object.freeze({
    bind: env.GEM_LAPTOP_BIND || '127.0.0.1',
    port: Number.parseInt(env.GEM_LAPTOP_PORT || '8766', 10),
    root,
    requestDir: resolve(env.GEM_LAPTOP_REQUEST_DIR || join(root, 'requests')),
    statusFile: resolve(env.GEM_LAPTOP_STATUS_FILE || join(root, 'status.json')),
    tokenFile: resolve(env.GEM_LAPTOP_TOKEN_FILE || join(root, 'auth-token.txt')),
    auditFile: resolve(env.GEM_LAPTOP_AUDIT_FILE || join(root, 'logs', 'laptop-backend-audit.jsonl')),
    dashboardFile: resolve(env.GEM_LAPTOP_DASHBOARD_FILE || join(packageRoot, 'public', 'index.html')),
  });
}

export function normalizeAction(value) {
  const action = String(value || '').trim().toLowerCase();
  return ACTIONS.has(action) ? action : null;
}

export function tokenMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string') return false;
  const left = Buffer.from(expected.trim(), 'utf8');
  const right = Buffer.from(supplied.trim(), 'utf8');
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(request) {
  const authorization = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || '';
}

async function loadToken(config) {
  const token = (await readFile(config.tokenFile, 'utf8')).trim();
  if (token.length < 32) throw new Error('GEM laptop bearer token is missing or too short.');
  return token;
}

function securityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
}

function sendJson(response, statusCode, payload) {
  securityHeaders(response);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function safeReadStatus(config) {
  try {
    const [text, metadata] = await Promise.all([
      readFile(config.statusFile, 'utf8'),
      stat(config.statusFile),
    ]);
    return { status: JSON.parse(text), modifiedAt: metadata.mtime };
  } catch {
    return { status: null, modifiedAt: null };
  }
}

function safeStatusView(raw, modifiedAt) {
  const status = raw && typeof raw === 'object' ? raw : {};
  const updatedAt = typeof status.updatedAt === 'string' ? status.updatedAt : null;
  const timestamp = updatedAt ? Date.parse(updatedAt) : modifiedAt?.getTime();
  const ageSeconds = Number.isFinite(timestamp) ? Math.max(0, Math.round((Date.now() - timestamp) / 1000)) : null;

  return {
    continuityVersion: String(status.continuityVersion || VERSION),
    coreVersion: String(status.coreVersion || CORE_VERSION),
    agentUser: typeof status.agentUser === 'string' ? status.agentUser : null,
    backendHealthy: status.backendHealthy === true,
    pipelineReady: status.pipelineReady === true,
    obsRunning: status.obsRunning === true,
    obsWebSocket: status.obsWebSocket === true,
    pinokioRunning: status.pinokioRunning === true,
    sessionEnabled: status.sessionEnabled === true,
    lastAction: typeof status.lastAction === 'string' ? status.lastAction : null,
    startupGraceSeconds: Number.isInteger(status.startupGraceSeconds) ? status.startupGraceSeconds : null,
    tailscaleAddress: typeof status.tailscale?.address === 'string' ? status.tailscale.address : '',
    tailscaleDnsName: typeof status.tailscale?.dnsName === 'string' ? status.tailscale.dnsName : '',
    openSshStatus: typeof status.openSsh?.status === 'string' ? status.openSsh.status : 'Unknown',
    openSshPort22: status.openSsh?.port22 === true,
    updatedAt,
    ageSeconds,
    agentFresh: ageSeconds !== null && ageSeconds <= 20,
  };
}

async function appendAudit(config, entry) {
  await mkdir(dirname(config.auditFile), { recursive: true });
  await appendFile(config.auditFile, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function queueAction(config, action, request) {
  await mkdir(config.requestDir, { recursive: true });
  const finalPath = join(config.requestDir, `${action}.request`);
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  const requestId = createHash('sha256')
    .update(`${action}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 24);

  const payload = {
    requestId,
    action,
    createdAt: new Date().toISOString(),
    source: 'gem-laptop-backend',
  };

  await writeFile(temporaryPath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, finalPath);
  await appendAudit(config, {
    ...payload,
    remoteAddress: request.socket.remoteAddress || '',
    userAgent: String(request.headers['user-agent'] || '').slice(0, 200),
  });

  return payload;
}

function base44DevicePayload(status) {
  return {
    schemaVersion: 1,
    deviceName: 'GEM-ASSIST',
    continuityVersion: status.continuityVersion,
    coreVersion: status.coreVersion,
    online: status.agentFresh,
    backendHealthy: status.backendHealthy,
    pipelineReady: status.pipelineReady,
    obsReady: status.obsRunning && status.obsWebSocket,
    pinokioRunning: status.pinokioRunning,
    lastAction: status.lastAction,
    updatedAt: status.updatedAt,
  };
}

async function authorize(request, response, config) {
  try {
    const expected = await loadToken(config);
    if (!tokenMatches(expected, bearerToken(request))) {
      sendJson(response, 401, { error: 'UNAUTHORIZED' });
      return false;
    }
    return true;
  } catch (error) {
    sendJson(response, 503, { error: 'AUTH_NOT_CONFIGURED', message: error.message });
    return false;
  }
}

export function createApp(config = createConfig()) {
  return async function app(request, response) {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      const { status, modifiedAt } = await safeReadStatus(config);
      const view = safeStatusView(status, modifiedAt);
      let authConfigured = false;
      try {
        authConfigured = (await loadToken(config)).length >= 32;
      } catch {}
      return sendJson(response, 200, {
        status: 'ok',
        service: 'gem-laptop-backend',
        version: VERSION,
        authConfigured,
        agentFresh: view.agentFresh,
        pipelineReady: view.pipelineReady,
      });
    }

    if (request.method === 'GET' && url.pathname === '/') {
      securityHeaders(response);
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      try {
        response.end(await readFile(config.dashboardFile, 'utf8'));
      } catch {
        response.end('<!doctype html><title>GEM Laptop Backend</title><h1>Dashboard file missing</h1>');
      }
      return;
    }

    if (!(await authorize(request, response, config))) return;

    if (request.method === 'GET' && url.pathname === '/api/status') {
      const { status, modifiedAt } = await safeReadStatus(config);
      return sendJson(response, 200, safeStatusView(status, modifiedAt));
    }

    if (request.method === 'GET' && url.pathname === '/api/base44/device') {
      const { status, modifiedAt } = await safeReadStatus(config);
      return sendJson(response, 200, base44DevicePayload(safeStatusView(status, modifiedAt)));
    }

    const commandMatch = /^\/api\/commands\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'POST' && commandMatch) {
      const action = normalizeAction(commandMatch[1]);
      if (!action) return sendJson(response, 404, { error: 'ACTION_NOT_ALLOWED' });
      const accepted = await queueAction(config, action, request);
      return sendJson(response, 202, { accepted: true, ...accepted });
    }

    return sendJson(response, 404, { error: 'NOT_FOUND' });
  };
}

export function startServer(config = createConfig()) {
  const server = createServer((request, response) => {
    createApp(config)(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { error: 'INTERNAL_ERROR' });
      else response.destroy(error);
    });
  });

  server.listen(config.port, config.bind, () => {
    console.log(`GEM Laptop Backend ${VERSION} listening on http://${config.bind}:${config.port}`);
  });

  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
