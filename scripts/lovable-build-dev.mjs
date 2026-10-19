// Lovable build ("build:dev"). Not used by Vercel.
// 1. Runs the canonical build script so the full Next.js build is verified.
// 2. Writes dist/, which Lovable hosting serves. Lovable hosting only serves
//    static files and this app needs a server (API routes, auth, database),
//    so dist/ holds a page that forwards visitors to the live Vercel site.
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { prismaEngineEnv } from "./lovable-prisma-engines.mjs";

const env = {
  ...process.env,
  ...(await prismaEngineEnv()),
  NEXT_DEV_TURBOPACK_ROOT: "/",
};

const result = spawnSync("node", ["scripts/vercel-build.mjs"], { stdio: "inherit", env });
if (result.status !== 0) process.exit(result.status ?? 1);

const target = (process.env.NEXT_PUBLIC_APP_URL || "https://www.gemcybersecurityassist.com").replace(/\/$/, "");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEM Enterprise | Defend. Protect. Prevail.</title>
<meta name="description" content="Access-controlled cybersecurity, compliance, financial-security coordination, and property-risk services.">
<meta property="og:title" content="GEM Enterprise">
<meta property="og:description" content="Access-controlled cybersecurity, compliance, financial-security coordination, and property-risk services.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${target}/">
<meta http-equiv="refresh" content="0; url=${target}/">
<script>location.replace(${JSON.stringify(target)} + location.pathname + location.search + location.hash);</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d121b;color:#f9f7f4;font-family:system-ui,sans-serif}a{color:#00d5e6}</style>
</head>
<body><p>Opening GEM Enterprise&hellip; <a href="${target}/">Continue</a></p></body>
</html>
`;
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
writeFileSync("dist/404.html", html);
console.log(`Wrote dist/ (forwards to ${target}).`);
