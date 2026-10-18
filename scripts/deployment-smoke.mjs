const input = process.env.SMOKE_BASE_URL || process.argv[2];

if (!input) {
  console.error("SMOKE_BASE_URL (or a base URL argument) is required.");
  process.exit(2);
}

let baseUrl;
try {
  baseUrl = new URL(input);
} catch {
  console.error("SMOKE_BASE_URL must be a valid URL.");
  process.exit(2);
}

const isLocal = ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname);
if (baseUrl.protocol !== "https:" && !isLocal) {
  console.error("Deployment smoke verification requires HTTPS for non-local targets.");
  process.exit(2);
}

baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const requestHeaders = {
  "user-agent": "gem-enterprise-deployment-smoke/1.0",
  accept: "text/html,application/xhtml+xml",
};

if (bypassSecret) {
  requestHeaders["x-vercel-protection-bypass"] = bypassSecret;
  requestHeaders["x-vercel-set-bypass-cookie"] = "true";
}

const checks = [
  {
    path: "/",
    kind: "public",
    bodyIncludes: ["Request Access"],
    requiredHeaders: [
      "content-security-policy",
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options",
    ],
  },
  {
    path: "/get-started",
    kind: "public",
    bodyIncludes: ["Start with one controlled path into GEM Enterprise."],
  },
  {
    path: "/client-login",
    kind: "public",
  },
  {
    path: "/eligibility/status",
    kind: "public-or-auth-gate",
  },
];

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function isVercelProtectionLocation(location) {
  if (!location) return false;
  try {
    const resolved = new URL(location, baseUrl);
    return (
      resolved.hostname.endsWith("vercel.com") &&
      (resolved.pathname.includes("/sso-api") || resolved.pathname.includes("/login"))
    );
  } catch {
    return false;
  }
}

async function fetchRoute(path) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    headers: requestHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  const location = response.headers.get("location");
  if (isVercelProtectionLocation(location)) {
    throw new Error(
      `Vercel Deployment Protection blocked ${path}. Supply VERCEL_AUTOMATION_BYPASS_SECRET at runtime; never commit it.`,
    );
  }

  return { response, url, location };
}

const evidence = {
  checkedAt: new Date().toISOString(),
  baseUrl: baseUrl.origin,
  commitSha:
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    "unknown",
  results: [],
};

let failed = false;

for (const check of checks) {
  try {
    const { response, url, location } = await fetchRoute(check.path);
    const result = {
      path: check.path,
      status: response.status,
      location,
      passed: true,
      notes: [],
    };

    if (check.kind === "public") {
      if (response.status !== 200) {
        result.passed = false;
        result.notes.push(`expected HTTP 200, received ${response.status}`);
      }
    } else if (check.kind === "public-or-auth-gate") {
      if (response.status !== 200 && !isRedirect(response.status)) {
        result.passed = false;
        result.notes.push(`expected HTTP 200 or same-site auth redirect, received ${response.status}`);
      }
      if (isRedirect(response.status) && location) {
        const redirected = new URL(location, url);
        if (redirected.origin !== baseUrl.origin || !redirected.pathname.startsWith("/client-login")) {
          result.passed = false;
          result.notes.push(`unexpected redirect target ${redirected.origin}${redirected.pathname}`);
        }
      }
    }

    if (response.status === 200 && check.bodyIncludes?.length) {
      const body = await response.text();
      for (const fragment of check.bodyIncludes) {
        if (!body.includes(fragment)) {
          result.passed = false;
          result.notes.push(`missing expected body fragment: ${fragment}`);
        }
      }
    }

    for (const header of check.requiredHeaders || []) {
      if (!response.headers.get(header)) {
        result.passed = false;
        result.notes.push(`missing required security header: ${header}`);
      }
    }

    if (!result.passed) failed = true;
    evidence.results.push(result);
  } catch (error) {
    failed = true;
    evidence.results.push({
      path: check.path,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

evidence.passed = !failed;
console.log(JSON.stringify(evidence, null, 2));

if (failed) process.exit(1);
