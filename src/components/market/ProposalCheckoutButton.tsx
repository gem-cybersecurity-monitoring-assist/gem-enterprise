"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Smartphone } from "lucide-react";

export function ProposalCheckoutButton({ token, disabled = false }: { token: string; disabled?: boolean }) {
  const [loading, setLoading] = useState<"checkout" | "klarna" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function beginPayment(endpoint: string, mode: "checkout" | "klarna") {
    setLoading(mode);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(
          result.error ||
            (mode === "klarna"
              ? "Klarna app handoff is not available yet."
              : "Secure checkout is not available yet."),
        );
      }

      // The Klarna route returns Klarna's own payment_request_url. Navigating to that
      // URL directly avoids an intermediate GEM redirect and lets the OS apply the
      // provider's universal-link/app-handoff behavior when the Klarna app is installed.
      window.location.assign(result.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : mode === "klarna"
            ? "Klarna app handoff is not available yet."
            : "Secure checkout is not available yet.",
      );
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => void beginPayment("/api/market/checkout", "checkout")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading === "checkout" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
          {loading === "checkout" ? "Opening secure checkout…" : "Accept and continue to payment"}
        </button>

        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => void beginPayment("/api/market/klarna/handoff", "klarna")}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pink-300/50 bg-pink-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-pink-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading === "klarna" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          )}
          {loading === "klarna" ? "Opening Klarna…" : "Open Klarna app"}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        On a supported mobile device, the Klarna option uses Klarna&apos;s direct purchase-journey URL so the installed app can take over authentication when available.
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
