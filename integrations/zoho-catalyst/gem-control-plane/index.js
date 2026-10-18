"use strict";

const express = require("express");
const { callGem } = require("./bridge");

const app = express();
const PREFIX = "/server/gem_control_plane";
const VIEWS = new Set(["platform", "stores", "tiktok", "google"]);

app.disable("x-powered-by");

function normalizedPath(req) {
  const path = req.path || new URL(req.url || "/", `https://${req.headers?.host || "localhost"}`).pathname;
  return path.startsWith(PREFIX) ? path.slice(PREFIX.length) || "/" : path;
}

function send(res, status, body, headers = {}) {
  res.set({
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  return res.status(status).json(body);
}

function fail(res, error) {
  if (error?.code === "GEM_AGENT_NOT_CONFIGURED") {
    return send(res, 503, {
      ok: false,
      status: "BLOCKED_BY_CREDENTIAL",
      error: "gem_agent_not_configured",
    });
  }
  if (error?.code === "GEM_OPERATION_NOT_ALLOWED") {
    return send(res, 403, {
      ok: false,
      status: "BLOCKED_BY_POLICY",
      error: "operation_not_allowed",
    });
  }
  return send(res, 502, {
    ok: false,
    status: "FAILED",
    error: "gem_upstream_unavailable",
  });
}

app.all("*", async (req, res) => {
  try {
    const path = normalizedPath(req);

    if (req.method !== "GET") {
      return send(
        res,
        405,
        { ok: false, status: "BLOCKED_BY_POLICY", error: "method_not_allowed" },
        { Allow: "GET" },
      );
    }

    const operation = path === "/health" ? "health" : path === "/context" ? "context" : null;
    if (!operation) {
      return send(res, 404, {
        ok: false,
        status: "BLOCKED_BY_POLICY",
        error: "route_not_exposed",
      });
    }

    const view = typeof req.query?.view === "string" ? req.query.view : "";
    if (operation === "context" && view && !VIEWS.has(view)) {
      return send(res, 400, {
        ok: false,
        status: "BLOCKED_BY_POLICY",
        error: "invalid_context_view",
      });
    }

    const result = await callGem(operation, operation === "context" && view ? { view } : {});
    return send(res, result.status, result.body);
  } catch (error) {
    return fail(res, error);
  }
});

module.exports = app;
