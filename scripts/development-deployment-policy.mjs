export const developmentProjectId = "prj_BcEaEo1E25IOw30KcGQBfwIoVCQ9";
export const developmentBranch = "deploy/gem-enterprise-development";
export const developmentDatabaseRef = "dusqdnebwkoycdtjkhyy";

export const developmentDisabledFlags = [
  "SOCIAL_MEDIA_LIVE_PUBLISHING_ENABLED", "TOKMETRIC_LIVE_PUBLISHING_ENABLED",
  "TOKMETRIC_SANDBOX_PUBLISHING_ENABLED", "SOCIAL_GATEWAY_PUBLISHING_ADAPTER_ENABLED",
  "SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED", "SOCIAL_AUTOPILOT_ENABLED",
  "SOCIAL_AUTOPILOT_AUTO_APPROVAL_ENABLED", "META_SOCIAL_PUBLISHING_ENABLED",
  "X_SOCIAL_PUBLISHING_ENABLED", "LINKEDIN_SOCIAL_PUBLISHING_ENABLED",
  "YOUTUBE_PUBLISHING_ENABLED", "NEXTDOOR_PUBLISHING_ENABLED",
  "TELEGRAM_SOCIAL_PUBLISHING_ENABLED", "FACEBOOK_AUTOMATION_ENABLED",
  "META_SOCIAL_OAUTH_ENABLED", "X_SOCIAL_OAUTH_ENABLED", "YOUTUBE_SOCIAL_OAUTH_ENABLED",
  "TOKMETRIC_TIKTOK_OAUTH_ENABLED", "TIKTOK_SHOP_OAUTH_ENABLED",
  "GEM_AUTH_GATEWAY_ENABLED", "GEM_INTAKE_GATEWAY_ENABLED",
  "GEM_TOKMETRIC_GPT_GATEWAY_ENABLED", "GEM_TOKMETRIC_AGENT_GATEWAY_ENABLED",
  "GEM_AI_PROVIDER_ENABLED", "RUN_DB_MIGRATIONS", "AUTO_DB_PUSH", "AUTO_DB_SEED",
  "SEED_DEMO_DATA", "GEM_VERIFY_DOCUMENT_UPLOAD_ACTIVE",
];

export function developmentDeploymentError(env, config) {
  if (env.VERCEL_PROJECT_ID !== developmentProjectId) return "development profile requires its exact project ID";
  if (env.GEM_DEPLOYMENT_PROFILE !== "development") return "development profile must be explicitly enabled";
  if (env.VERCEL_ENV !== "preview") return "development is allowed only as a protected preview";
  if (env.VERCEL_GIT_COMMIT_REF !== developmentBranch) return "development requires its dedicated deployment branch";
  if (!config || config.buildCommand !== "node scripts/vercel-development-build.mjs") return "development build command is not selected";
  if (!Array.isArray(config.crons) || config.crons.length) return "development cron definitions must be empty";
  if (config.env?.GEM_DEPLOYMENT_PROFILE !== "development") return "development config profile is missing";
  for (const key of developmentDisabledFlags) {
    if (config.env?.[key] !== "false") return `development config must disable ${key}`;
    if (env[key] && env[key] !== "false") return `development runtime must disable ${key}`;
  }
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (config.env?.[key] !== `https://${developmentDatabaseRef}.supabase.co`) return `development config has the wrong ${key}`;
  }
  if (config.env?.GEM_SUPABASE_GATEWAY_BASE_URL !== `https://${developmentDatabaseRef}.supabase.co/functions/v1`) return "development gateway target is incorrect";
  if (/slzdjoqpzbkwzuaexlkj|gemcybersecurityassist\.com|support371-gem-enterprise/.test(JSON.stringify(config))) return "development config contains a production target";
  for (const [key, value] of Object.entries(config.env)) {
    if (typeof value === "string" && value.startsWith("https://") && env[key] !== value) return `development runtime target must match selected config: ${key}`;
  }
  return null;
}

export function developmentCredentialError(env) {
  for (const key of ["POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"]) {
    if (!env[key]) return `Missing development-only ${key}`;
    try {
      const url = new URL(env[key]);
      const runtimeUsers = ["postgres", "gem_dev_runtime"];
      const username = decodeURIComponent(url.username);
      const direct = url.hostname === `db.${developmentDatabaseRef}.supabase.co` && runtimeUsers.includes(username);
      const pooled = url.hostname.endsWith(".pooler.supabase.com") && runtimeUsers.some((role) => username === `${role}.${developmentDatabaseRef}`);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || (!direct && !pooled) || !url.password || url.searchParams.getAll("sslmode").join(",") !== "require" || url.searchParams.getAll("sslaccept").join(",") !== "strict") return `Invalid development-only ${key}: exact database target and strict TLS required`;
    } catch { return `Invalid development-only ${key}`; }
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) return "Missing development-only JWT_SECRET (at least 32 characters)";
  return null;
}
