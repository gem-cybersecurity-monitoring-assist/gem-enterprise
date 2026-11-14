/** Explicitly bind direct social transactions to the database that owns gateway sign-in. */
export function hasSocialTransactionalAuthority(env: Readonly<Record<string, string | undefined>> = process.env, connectionOverride?: string): boolean {
  if (env.SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED !== "true") return false;
  const connection = connectionOverride ?? (env.POSTGRES_PRISMA_URL?.trim() || env.DATABASE_URL?.trim() ||
    env.POSTGRES_URL?.trim() || env.NEON_DATABASE_URL?.trim());
  if (!connection) return false;

  try {
    const gateway = new URL(
      env.GEM_SUPABASE_GATEWAY_BASE_URL?.trim() ||
      "https://slzdjoqpzbkwzuaexlkj.supabase.co/functions/v1",
    );
    const project = /^([a-z0-9]{20})\.supabase\.co$/.exec(gateway.hostname)?.[1];
    if (!project || gateway.protocol !== "https:" || gateway.port ||
      gateway.username || gateway.password || !/^\/functions\/v1\/?$/.test(gateway.pathname)) return false;

    const database = new URL(connection);
    if (!["postgresql:", "postgres:"].includes(database.protocol) ||
      database.pathname !== "/postgres" || database.searchParams.getAll("sslmode").join(",") !== "require" ||
      database.searchParams.getAll("sslaccept").join(",") !== "strict") return false;
    const user = decodeURIComponent(database.username);
    if (database.hostname === `db.${project}.supabase.co`) return user === "postgres";
    return /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(database.hostname) &&
      user === `postgres.${project}`;
  } catch {
    return false;
  }
}

/** Validate the selected social connection without creating clients or changing global configuration. */
export function hasScopedSocialTransactionalAuthority(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const supplied = env.GEM_SOCIAL_POSTGRES_PRISMA_URL?.trim();
  if (!supplied) return hasSocialTransactionalAuthority(env);
  try {
    const connection = new URL(supplied);
    if (!connection.searchParams.has("sslmode")) connection.searchParams.set("sslmode", "require");
    if (!connection.searchParams.has("sslaccept")) connection.searchParams.set("sslaccept", "strict");
    return hasSocialTransactionalAuthority(env, connection.toString());
  } catch { return false; }
}
