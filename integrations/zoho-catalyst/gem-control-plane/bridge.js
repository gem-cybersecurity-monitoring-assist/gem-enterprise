"use strict";

const DEFAULT_GEM_AGENT_API_BASE_URL = "https://support371-gem-enterprise.vercel.app";
const REQUEST_TIMEOUT_MS = 10000;

const ALLOWED_ROUTES = Object.freeze({
  health: "/api/agent/health",
  context: "/api/agent/context",
});

function cleanBaseUrl(value) {
  return (value || DEFAULT_GEM_AGENT_API_BASE_URL).trim().replace(/\/+$/, "");
}

function configuredAgentKey() {
  return (process.env.GEM_AGENT_API_KEY || "").trim();
}

function assertConfigured() {
  const key = configuredAgentKey();
  if (key.length < 32) {
    const error = new Error("GEM agent credential is not configured");
    error.code = "GEM_AGENT_NOT_CONFIGURED";
    throw error;
  }
  return key;
}

async function callGem(operation, query = {}, fetchImpl = global.fetch) {
  const path = ALLOWED_ROUTES[operation];
  if (!path) {
    const error = new Error("Unsupported GEM bridge operation");
    error.code = "GEM_OPERATION_NOT_ALLOWED";
    throw error;
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const key = assertConfigured();
  const url = new URL(`${cleanBaseUrl(process.env.GEM_AGENT_API_BASE_URL)}${path}`);
  for (const [name, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-gem-agent-key": key,
        "x-gem-bridge": "zoho-catalyst",
      },
      signal: controller.signal,
      redirect: "error",
    });

    let body;
    try {
      body = await response.json();
    } catch {
      body = { ok: false, error: "invalid_upstream_response" };
    }

    return {
      status: response.status,
      ok: response.ok,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  ALLOWED_ROUTES,
  callGem,
  cleanBaseUrl,
  configuredAgentKey,
};
