import { describe, expect, it } from "vitest";
import { hasSocialTransactionalAuthority } from "@/lib/social-media/transactional-authority";

const project = "slzdjoqpzbkwzuaexlkj";
const tls = "sslmode=require&sslaccept=strict";
const direct = `postgresql://postgres:placeholder@db.${project}.supabase.co:5432/postgres?${tls}`;
const pooler = `postgresql://postgres.${project}:placeholder@aws-0-us-east-1.pooler.supabase.com:6543/postgres?${tls}`;

describe("social transaction authority", () => {
  it("accepts TLS-verified direct and pooled connections to the sign-in project", () => {
    for (const url of [direct, pooler]) {
      expect(hasSocialTransactionalAuthority({
        SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED: "true",
        POSTGRES_PRISMA_URL: url,
      })).toBe(true);
    }
  });

  it("rejects disabled, mismatched, unverified and ambiguous configurations", () => {
    expect(hasSocialTransactionalAuthority({ POSTGRES_PRISMA_URL: direct })).toBe(false);
    for (const url of [
      direct.replace(project, "aaaaaaaaaaaaaaaaaaaa"),
      pooler.replace(project, "aaaaaaaaaaaaaaaaaaaa"),
      direct.replace("strict", "accept_invalid_certs"),
      direct + "&sslaccept=accept_invalid_certs",
      direct.replace(".supabase.co:", ".supabase.co.example.org:"),
      direct.replace("/postgres?", "/other?"),
      "invalid",
    ]) {
      expect(hasSocialTransactionalAuthority({
        SOCIAL_GATEWAY_DIRECT_TRANSACTIONS_ENABLED: "true",
        POSTGRES_PRISMA_URL: url,
        DATABASE_URL: direct,
      })).toBe(false);
    }
  });
});
