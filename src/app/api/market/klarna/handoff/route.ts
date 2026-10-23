import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getIntakeSubmission, IntakeStoreUnavailableError } from "@/lib/intake/repository";
import { getMarketPaymentReadiness, verifyProposalToken } from "@/lib/market/proposal";

const bodySchema = z.object({ token: z.string().trim().min(20).max(4_000) });

const KLARNA_AMOUNT_CENTS = 29_900;
const KLARNA_CURRENCY = "USD";

type DirectKlarnaConfig = {
  mode: "direct";
  partnerAccountId: string;
  authorization: string;
  apiBase: string;
  environment: "test" | "live";
};

type ProviderKlarnaConfig = {
  mode: "provider";
  endpoint: string;
  authorization?: string;
};

type KlarnaTransportConfig = DirectKlarnaConfig | ProviderKlarnaConfig;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function getBasicAuthorization() {
  const supplied = process.env.GEM_KLARNA_BASIC_AUTH?.trim();
  if (supplied) return supplied.startsWith("Basic ") ? supplied : `Basic ${supplied}`;

  const username = process.env.GEM_KLARNA_API_USERNAME?.trim();
  const password = process.env.GEM_KLARNA_API_PASSWORD?.trim();
  if (!username || !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function getDirectKlarnaConfig(): DirectKlarnaConfig | null {
  const partnerAccountId = process.env.GEM_KLARNA_PARTNER_ACCOUNT_ID?.trim();
  const authorization = getBasicAuthorization();
  const environment = process.env.GEM_KLARNA_ENV === "live" ? "live" : "test";
  const apiBase =
    environment === "live"
      ? "https://api-global.klarna.com"
      : "https://api-global.test.klarna.com";

  if (!partnerAccountId || !authorization) return null;
  return { mode: "direct", partnerAccountId, authorization, apiBase, environment };
}

function getProviderKlarnaConfig(): ProviderKlarnaConfig | null {
  const rawEndpoint = process.env.GEM_KLARNA_PROVIDER_HANDOFF_URL?.trim();
  if (!rawEndpoint) return null;

  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    return null;
  }
  if (endpoint.protocol !== "https:") return null;

  const suppliedAuth = process.env.GEM_KLARNA_PROVIDER_AUTH?.trim();
  const bearerToken = process.env.GEM_KLARNA_PROVIDER_TOKEN?.trim();
  const authorization = suppliedAuth || (bearerToken ? `Bearer ${bearerToken}` : undefined);

  return { mode: "provider", endpoint: endpoint.toString(), authorization };
}

function getKlarnaTransportConfig(): KlarnaTransportConfig | null {
  const requested = process.env.GEM_KLARNA_HANDOFF_MODE?.trim().toLowerCase();
  const provider = getProviderKlarnaConfig();
  const direct = getDirectKlarnaConfig();

  if (requested === "provider") return provider;
  if (requested === "direct") return direct;

  // Prefer provider-backed mode when configured. This removes the requirement for GEM itself
  // to own Klarna Partner credentials while still requiring an upstream authorized provider.
  return provider || direct;
}

function isTrustedKlarnaHandoffUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "pay.klarna.com" || url.hostname === "pay.test.klarna.com")
    );
  } catch {
    return false;
  }
}

async function authorizeViaProvider(input: {
  config: ProviderKlarnaConfig;
  publicId: string;
  paymentTransactionReference: string;
  returnUrl: string;
  appReturnUrl?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": input.paymentTransactionReference,
  };
  if (input.config.authorization) headers.Authorization = input.config.authorization;

  const response = await fetch(input.config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: "klarna",
      handoff: "app",
      currency: KLARNA_CURRENCY,
      amount: KLARNA_AMOUNT_CENTS,
      reference: input.publicId,
      payment_transaction_reference: input.paymentTransactionReference,
      return_url: input.returnUrl,
      app_return_url: input.appReturnUrl,
      line_items: [
        {
          name: "GEM Rapid Security Assessment",
          quantity: 1,
          unit_price: KLARNA_AMOUNT_CENTS,
          total_amount: KLARNA_AMOUNT_CENTS,
        },
      ],
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string;
        payment_request_url?: string;
        payment_request?: { payment_request_url?: string };
      }
    | null;

  if (!response.ok || !payload) {
    console.error("[Klarna provider handoff] authorization failed", response.status);
    return { kind: "error" as const };
  }

  const handoffUrl = payload.payment_request_url || payload.payment_request?.payment_request_url;
  if (handoffUrl) {
    if (!isTrustedKlarnaHandoffUrl(handoffUrl)) return { kind: "invalid_url" as const };
    return { kind: "handoff" as const, url: handoffUrl };
  }

  if (payload.status?.toLowerCase() === "approved") return { kind: "approved" as const };
  if (payload.status?.toLowerCase() === "declined") return { kind: "declined" as const };
  return { kind: "unknown" as const };
}

async function authorizeDirect(input: {
  config: DirectKlarnaConfig;
  publicId: string;
  paymentTransactionReference: string;
  returnUrl: string;
  appReturnUrl?: string;
}) {
  const customerInteractionConfig: Record<string, string> = {
    return_url: input.returnUrl,
  };
  if (input.appReturnUrl) customerInteractionConfig.app_return_url = input.appReturnUrl;

  const response = await fetch(
    `${input.config.apiBase}/v2/accounts/${encodeURIComponent(input.config.partnerAccountId)}/payment/authorize`,
    {
      method: "POST",
      headers: {
        Authorization: input.config.authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": input.paymentTransactionReference,
      },
      body: JSON.stringify({
        currency: KLARNA_CURRENCY,
        supplementary_purchase_data: {
          purchase_reference: input.publicId,
          line_items: [
            {
              name: "GEM Rapid Security Assessment",
              quantity: 1,
              unit_price: KLARNA_AMOUNT_CENTS,
              total_amount: KLARNA_AMOUNT_CENTS,
            },
          ],
        },
        request_payment_transaction: {
          amount: KLARNA_AMOUNT_CENTS,
          payment_transaction_reference: input.paymentTransactionReference,
        },
        step_up_config: {
          type: "HANDOVER",
          customer_interaction_config: customerInteractionConfig,
        },
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        payment_transaction_response?: { result?: string };
        payment_request?: { payment_request_url?: string };
      }
    | null;

  if (!response.ok || !payload) {
    console.error("[Klarna direct handoff] authorization failed", response.status);
    return { kind: "error" as const };
  }

  const outcome = payload.payment_transaction_response?.result;
  if (outcome === "STEP_UP_REQUIRED") {
    const paymentRequestUrl = payload.payment_request?.payment_request_url;
    if (!isTrustedKlarnaHandoffUrl(paymentRequestUrl)) return { kind: "invalid_url" as const };
    return { kind: "handoff" as const, url: paymentRequestUrl };
  }
  if (outcome === "APPROVED") return { kind: "approved" as const };
  if (outcome === "DECLINED") return { kind: "declined" as const };
  return { kind: "unknown" as const };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid proposal token" }, 400);

  const tokenPayload = verifyProposalToken(parsed.data.token);
  if (!tokenPayload) return json({ error: "The proposal link is invalid or expired." }, 401);

  const marketReadiness = getMarketPaymentReadiness();
  if (!marketReadiness.proposalSigningReady) {
    return json({ error: "GEM secure payment authorization is unavailable." }, 503);
  }

  const transport = getKlarnaTransportConfig();
  if (!transport) {
    return json(
      {
        error: "Klarna app handoff is not activated yet. Configure an authorized payment provider or direct Klarna merchant credentials.",
        code: "KLARNA_APP_HANDOFF_NOT_CONFIGURED",
      },
      503,
    );
  }

  try {
    const result = await getIntakeSubmission(tokenPayload.intakeId);
    if (
      !result ||
      result.submission.publicId !== tokenPayload.publicId ||
      result.submission.kind !== "ENTERPRISE"
    ) {
      return json({ error: "The proposal no longer matches an enterprise opportunity." }, 404);
    }

    if (result.submission.status !== "APPROVED") {
      return json(
        {
          error: "Payment remains locked until GEM completes human scope approval.",
          code: "OPPORTUNITY_NOT_APPROVED",
        },
        409,
      );
    }

    const returnUrl = new URL("/business-review/payment/success", request.nextUrl.origin);
    returnUrl.searchParams.set("reference", result.submission.publicId);
    returnUrl.searchParams.set("provider", "klarna");

    const appReturnUrl = process.env.GEM_KLARNA_APP_RETURN_URL?.trim();
    const paymentTransactionReference = `gem-${result.submission.publicId}`.slice(0, 128);

    const authorization =
      transport.mode === "provider"
        ? await authorizeViaProvider({
            config: transport,
            publicId: result.submission.publicId,
            paymentTransactionReference,
            returnUrl: returnUrl.toString(),
            appReturnUrl,
          })
        : await authorizeDirect({
            config: transport,
            publicId: result.submission.publicId,
            paymentTransactionReference,
            returnUrl: returnUrl.toString(),
            appReturnUrl,
          });

    if (authorization.kind === "handoff") {
      // Return Klarna's own universal payment_request_url directly. Do not wrap it in a GEM
      // browser redirect; iOS/Android can hand the URL to the installed Klarna app.
      return json({
        ok: true,
        handoff: "klarna_app",
        transport: transport.mode,
        url: authorization.url,
      });
    }

    if (authorization.kind === "approved") {
      return json({
        ok: true,
        handoff: "complete",
        transport: transport.mode,
        url: returnUrl.toString(),
      });
    }

    if (authorization.kind === "declined") {
      return json(
        {
          error: "Klarna did not approve this payment. No alternate payment was attempted.",
          code: "KLARNA_DECLINED",
        },
        402,
      );
    }

    if (authorization.kind === "invalid_url") {
      return json(
        {
          error: "The payment provider did not return a trusted Klarna app-handoff URL. No payment has been taken.",
          code: "KLARNA_HANDOFF_URL_INVALID",
        },
        502,
      );
    }

    if (authorization.kind === "error") {
      return json(
        {
          error: "The payment provider could not start the secure Klarna app handoff. No payment has been taken.",
          code: "KLARNA_AUTHORIZATION_FAILED",
        },
        502,
      );
    }

    return json(
      {
        error: "The payment provider returned an unsupported Klarna authorization state. No payment has been taken.",
        code: "KLARNA_UNKNOWN_STATE",
      },
      502,
    );
  } catch (error) {
    if (error instanceof IntakeStoreUnavailableError) {
      return json({ error: error.message, code: "INTAKE_STORAGE_NOT_READY" }, 503);
    }
    console.error("[POST /api/market/klarna/handoff]", error);
    return json(
      {
        error: "Klarna app handoff is temporarily unavailable. No payment has been taken.",
      },
      500,
    );
  }
}
