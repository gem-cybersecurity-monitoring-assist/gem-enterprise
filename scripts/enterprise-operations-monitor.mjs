import tls from "node:tls";

const DEFAULT_BASE_URL = "https://www.gemcybersecurityassist.com";
const DEFAULT_PORTAL_URL = "https://portal.gemcybersecurityassist.com";
const DEFAULT_ADMIN_URL = "https://admin.gemcybersecurityassist.com";
const REQUEST_TIMEOUT_MS = 20_000;
const MINIMUM_TLS_DAYS = 14;

const baseUrl = normalizedOrigin(
  process.env.GEM_MONITOR_BASE_URL || DEFAULT_BASE_URL,
);
const portalUrl = normalizedOrigin(
  process.env.GEM_MONITOR_PORTAL_URL || DEFAULT_PORTAL_URL,
);
const adminUrl = normalizedOrigin(
  process.env.GEM_MONITOR_ADMIN_URL || DEFAULT_ADMIN_URL,
);

const checks = [];

function normalizedOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`Only HTTPS monitoring targets are allowed: ${value}`);
  }
  return url.origin;
}

function record(name, passed, detail, durationMs = null) {
  checks.push({ name, passed, detail, durationMs });
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      redirect: options.redirect || "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "GEM-Enterprise-Operations-Monitor/1.0",
        ...(options.headers || {}),
      },
    });
    return { response, durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHttpStatus(name, url, expectedStatuses) {
  try {
    const { response, durationMs } = await fetchWithTimeout(url, {
      redirect: "manual",
    });
    const passed = expectedStatuses.includes(response.status);
    record(
      name,
      passed,
      `HTTP ${response.status}; expected ${expectedStatuses.join("/")}`,
      durationMs,
    );
    return response;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function checkPublicSecurityHeaders() {
  const url = `${baseUrl}/`;

  try {
    const { response, durationMs } = await fetchWithTimeout(url);
    const required = {
      "content-security-policy": (value) =>
        value.includes("object-src 'none'") &&
        value.includes("frame-ancestors 'none'"),
      "strict-transport-security": (value) =>
        value.includes("max-age=") && value.includes("includeSubDomains"),
      "x-content-type-options": (value) => value.toLowerCase() === "nosniff",
      "x-frame-options": (value) => value.toUpperCase() === "DENY",
      "referrer-policy": (value) => value.length > 0,
      "permissions-policy": (value) => value.length > 0,
    };

    const failures = [];
    for (const [header, validate] of Object.entries(required)) {
      const value = response.headers.get(header) || "";
      if (!validate(value)) failures.push(header);
    }

    record(
      "Public security headers",
      response.status === 200 && failures.length === 0,
      failures.length === 0
        ? "Required response protections are present"
        : `Missing or invalid: ${failures.join(", ")}`,
      durationMs,
    );
  } catch (error) {
    record(
      "Public security headers",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkBootstrapSafety() {
  const url = `${baseUrl}/api/system/bootstrap-status`;

  try {
    const { response, durationMs } = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : null;

    const assertions = {
      "response.ok": response.ok,
      "payload.ok": data?.ok === true,
      "production environment": data?.deployment?.environment === "production",
      "canonical Vercel project":
        data?.deployment?.projectIdMatchesCanonical === true,
      "core ready": data?.core?.ready === true,
      "gateway operational": data?.core?.gateway?.operational === true,
      "administrator configured":
        data?.core?.gateway?.administratorConfigured === true,
      "evidence gateway operational":
        data?.evidenceVault?.gateway?.operational === true,
      "uploads fail closed": data?.evidenceVault?.uploadsFailClosed === true,
      "secret values hidden": data?.safety?.secretValuesExposed === false,
      "demo data disabled": data?.safety?.demoDataEnabled === false,
      "automatic database push disabled":
        data?.safety?.automaticDatabasePushEnabled === false,
      "automatic database seed disabled":
        data?.safety?.automaticDatabaseSeedEnabled === false,
      "automatic migrations disabled":
        data?.safety?.automaticMigrationEnabled === false,
    };

    const failed = Object.entries(assertions)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    record(
      "Production bootstrap safety",
      failed.length === 0,
      failed.length === 0
        ? `All fail-closed assertions passed at commit ${data?.deployment?.commitSha || "unknown"}`
        : `Failed assertions: ${failed.join(", ")}`,
      durationMs,
    );
  } catch (error) {
    record(
      "Production bootstrap safety",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function checkTls(hostname) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: true,
        timeout: REQUEST_TIMEOUT_MS,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        const expiresAt = Date.parse(certificate.valid_to);
        const remainingDays = Math.floor(
          (expiresAt - Date.now()) / (24 * 60 * 60 * 1000),
        );
        const passed =
          Number.isFinite(remainingDays) && remainingDays >= MINIMUM_TLS_DAYS;
        record(
          `TLS certificate: ${hostname}`,
          passed,
          Number.isFinite(remainingDays)
            ? `${remainingDays} days remaining`
            : "Certificate expiry could not be read",
          Date.now() - startedAt,
        );
        socket.end();
        resolve();
      },
    );

    socket.on("timeout", () => {
      record(
        `TLS certificate: ${hostname}`,
        false,
        "TLS connection timed out",
        Date.now() - startedAt,
      );
      socket.destroy();
      resolve();
    });

    socket.on("error", (error) => {
      record(
        `TLS certificate: ${hostname}`,
        false,
        error.message,
        Date.now() - startedAt,
      );
      resolve();
    });
  });
}

await Promise.all([
  checkHttpStatus("Public homepage", `${baseUrl}/`, [200]),
  checkHttpStatus("Public OpenAPI endpoint", `${baseUrl}/api/openapi`, [200]),
  checkHttpStatus("Private client portal", `${portalUrl}/`, [401]),
  checkHttpStatus("Private admin portal", `${adminUrl}/`, [401]),
  checkPublicSecurityHeaders(),
  checkBootstrapSafety(),
  checkTls(new URL(baseUrl).hostname),
  checkTls(new URL(portalUrl).hostname),
  checkTls(new URL(adminUrl).hostname),
]);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  targets: { baseUrl, portalUrl, adminUrl },
  summary: {
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
    total: checks.length,
  },
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  const rows = checks
    .map(
      (check) =>
        `| ${check.passed ? "PASS" : "FAIL"} | ${check.name} | ${check.detail.replaceAll("|", "\\|")} | ${check.durationMs ?? "n/a"} |`,
    )
    .join("\n");

  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "# GEM Enterprise operations monitor",
      "",
      `Result: ${report.summary.passed}/${report.summary.total} checks passed.`,
      "",
      "| Status | Check | Detail | Duration (ms) |",
      "| --- | --- | --- | ---: |",
      rows,
      "",
    ].join("\n"),
  );
}

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
