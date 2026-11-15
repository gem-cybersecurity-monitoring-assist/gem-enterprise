/** Only the legacy core Prisma datasource aliases are recognized here.
 * A namespaced GEM_SOCIAL_* credential cannot authorize unrelated workspace
 * and Command Center reads. Configuration does not prove database access.
 */
export function hasCorePrismaRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return [
    env.POSTGRES_PRISMA_URL,
    env.DATABASE_URL,
    env.POSTGRES_URL,
    env.NEON_DATABASE_URL,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}
