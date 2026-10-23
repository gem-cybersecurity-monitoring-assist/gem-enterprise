import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const routeSource = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8")
const loginRouteSource = readFileSync("src/app/api/auth/login/route.ts", "utf8")
const gatewaySource = readFileSync("src/lib/supabase-gateway.ts", "utf8")
const resetServiceSource = readFileSync("src/lib/passwordResetService.ts", "utf8")
const resetHandlerSource = readFileSync("src/lib/passwordResetHandler.ts", "utf8")
const forgotPageSource = readFileSync("src/app/forgot-password/page.tsx", "utf8")
const resetPageSource = readFileSync("src/app/reset-password/page.tsx", "utf8")

describe("canonical password recovery and session authority", () => {
  it("keeps password recovery inside the canonical application", () => {
    expect(routeSource).toContain("createPasswordResetToken")
    expect(routeSource).toContain("sendMail")
    expect(routeSource).toContain('new URL("/reset-password", appBaseUrl())')
    expect(routeSource).toContain("gatewayRecoveryDisabled: true")
    expect(routeSource).not.toContain("shouldUseSupabaseGateway()")
    expect(routeSource).not.toContain("requestPasswordRecoveryGateway")
    expect(routeSource).not.toContain("chatgpt.site")
  })

  it("never claims that an email was sent when canonical delivery is not configured", () => {
    expect(routeSource).toContain("EMAIL_NOT_CONFIGURED_RESPONSE")
    expect(routeSource).toContain("No reset email was sent")
    expect(routeSource).toContain("status: 503")
    expect(routeSource).toContain("isMailDeliveryConfigured()")
  })

  it("preserves a non-enumerating response when email delivery is active", () => {
    expect(routeSource).toContain("If an active GEM Enterprise account exists")
    expect(routeSource).not.toContain("account exists: true")
    expect(routeSource).not.toContain("account exists: false")
  })

  it("provides platform owners a protected recovery path without exposing a reset token", () => {
    expect(routeSource).toContain("https://admin.gemcybersecurityassist.com")
    expect(forgotPageSource).toContain("Open Command Center recovery")
    expect(forgotPageSource).toContain("Administrator credential recovery")
    expect(routeSource).not.toContain("resetToken:")
  })

  it("completes resets through canonical database authority and revokes sessions", () => {
    expect(resetServiceSource).toContain("verifyPasswordResetToken")
    expect(resetServiceSource).toContain("sessionVersion: user.sessionVersion")
    expect(resetServiceSource).toContain("updated.sessionVersion <= user.sessionVersion")
    expect(resetServiceSource).toContain("sessionsRevoked: true")
    expect(resetServiceSource).not.toContain("completePasswordRecoveryGateway")
    expect(resetServiceSource).not.toContain("shouldUseSupabaseGateway()")
  })

  it("does not duplicate trigger-recorded password-change audit evidence", () => {
    expect(resetServiceSource).toContain("auditRecorded: true")
    expect(resetHandlerSource).toContain("if (!result.auditRecorded)")
  })

  it("enforces the enterprise password policy in API and UI", () => {
    expect(resetHandlerSource).toContain(".min(14)")
    expect(resetHandlerSource).toContain(".max(128)")
    expect(resetHandlerSource).toContain(".regex(/[A-Z]/)")
    expect(resetPageSource).toContain("minLength={14}")
    expect(resetPageSource).toContain("maxLength={128}")
  })

  it("keeps reset capabilities in the URL fragment instead of server logs", () => {
    expect(routeSource).toContain("resetUrl.hash")
    expect(resetPageSource).toContain("window.location.hash")
    expect(resetPageSource).toContain("window.history.replaceState")
    expect(resetPageSource).not.toContain("searchParams.get(\"token\")")
  })

  it("validates and preserves gateway-issued session authority", () => {
    expect(loginRouteSource).toContain("loginWithGateway(email, password)")
    expect(loginRouteSource).toContain("validGatewaySession(result.session)")
    expect(loginRouteSource).toContain('session.authSource === "supabase_gateway"')
    expect(loginRouteSource).toContain("setSessionCookie(response, wrapGatewayToken(token))")
    expect(gatewaySource).toContain("wrapGatewayToken")
    expect(gatewaySource).toContain("verifyGatewaySession")
  })
})
