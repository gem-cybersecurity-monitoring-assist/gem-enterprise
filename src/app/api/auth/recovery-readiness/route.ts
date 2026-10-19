import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth-helpers";
import { getMailDeliveryReadiness } from "@/lib/mail/send";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const gate = await requireAdmin();
  const emailDelivery = getMailDeliveryReadiness();

  // Anonymous and non-admin callers only learn whether recovery email can be sent.
  if (!gate.ok) {
    return NextResponse.json(
      {
        ok: true,
        service: "gem-password-recovery",
        emailDeliveryConfigured: emailDelivery.configured,
        detailsRequireAdministrator: true,
      },
      { headers },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "gem-password-recovery",
      canonicalResetPage: true,
      resetPageOrigin: "https://www.gemcybersecurityassist.com",
      tokenTransport: "url_fragment",
      emailDeliveryConfigured: emailDelivery.configured,
      emailDelivery: {
        missingVariables: emailDelivery.missing,
        portValid: emailDelivery.portValid,
        secureSettingValid: emailDelivery.secureSettingValid,
        senderConfigured: emailDelivery.senderConfigured,
        replyToConfigured: emailDelivery.replyToConfigured,
        transportSecurity: emailDelivery.transportSecurity,
        transportVerification: "on_demand",
        verificationRequiresAdmin: true,
      },
      gatewayRecoveryDisabled: true,
      sessionRevocation: "database_password_change_trigger",
      legacyGatewaySessionsAccepted: false,
    },
    { headers },
  );
}
