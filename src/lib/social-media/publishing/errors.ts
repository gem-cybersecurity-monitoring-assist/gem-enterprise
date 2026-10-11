/**
 * Shared error type for the governed social publishing pipeline.
 *
 * Lives in its own module so provider upload/verification helpers can throw
 * it without creating an import cycle with adapters.ts. adapters.ts
 * re-exports it for backward compatibility.
 */
export class SocialPublishingAdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public options: {
      retryable?: boolean;
      reauthorizationRequired?: boolean;
      providerStatusCode?: number;
      safeMetadata?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
  }
}
