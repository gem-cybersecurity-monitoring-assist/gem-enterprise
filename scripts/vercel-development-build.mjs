import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { developmentDeploymentError, developmentCredentialError } from "./development-deployment-policy.mjs";

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const error = developmentDeploymentError(process.env, config) || developmentCredentialError(process.env);
if (error) throw new Error(error); // Only variable names and policy failures; never URLs or passwords.
const result = spawnSync(process.execPath, ["scripts/vercel-build.mjs"], { env: process.env, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
