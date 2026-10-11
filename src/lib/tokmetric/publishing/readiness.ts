export type PublishingContextGuidance = {
  title: string;
  detail: string;
  retryable: boolean;
};

/** Display the actual publishing restriction, not a misleading generic sign-in prompt. */
export function explainTokMetricPublishingContextError(
  code: string | null,
  message: string,
): PublishingContextGuidance {
  if (code === "TOKMETRIC_GATEWAY_BACKEND_REQUIRED") {
    return {
      title: "GEM is connected; provider publishing still requires backend activation",
      detail:
        "This account uses the Supabase gateway, but GEM has not yet verified a transactional TokMetric publishing backend for that authentication mode. Reconnecting TikTok or signing in again will not activate publishing. Approved videos stay private until the backend and provider publishing permissions are verified.",
      retryable: false,
    };
  }
  if (code === "UNAUTHENTICATED") {
    return {
      title: "Sign in to GEM Enterprise",
      detail: "A valid GEM Enterprise session is required before Video Studio can load authorized workspaces.",
      retryable: true,
    };
  }
  if (code === "ACCOUNT_NOT_ACTIVE" || code === "WORKSPACE_FORBIDDEN") {
    return {
      title: "Publishing access is not approved",
      detail: "This account needs an active approved workspace membership and publishing permissions. Ask a GEM administrator to review your access.",
      retryable: false,
    };
  }
  return {
    title: "Video Studio could not check publishing readiness",
    detail: message.trim() || "The publishing service is temporarily unavailable. Please recheck its status.",
    retryable: true,
  };
}
