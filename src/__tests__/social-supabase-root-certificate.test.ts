import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { supabaseRootCertificate, supabaseRootCertificatePath } from "@/lib/social-media/supabase-root-certificate";

describe("scoped Supabase TLS trust", () => {
  it("pins the official public root and writes the exact certificate", () => {
    const cert = new X509Certificate(supabaseRootCertificate);
    expect(cert.ca).toBe(true);
    expect(cert.subject).toContain("CN=Supabase Root 2021 CA");
    expect(cert.fingerprint256.replaceAll(":", "").toLowerCase()).toBe("807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa");
    expect(cert.verify(cert.publicKey)).toBe(true);
    const path = supabaseRootCertificatePath();
    expect(readFileSync(path, "utf8")).toBe(supabaseRootCertificate);
    expect(supabaseRootCertificatePath()).toBe(path);
  });
});
