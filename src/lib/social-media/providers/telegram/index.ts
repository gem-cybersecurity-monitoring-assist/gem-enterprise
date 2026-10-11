/**
 * Telegram provider package for the unified social publishing worker.
 * Server-side only — never import from client components.
 */
export * from "./config";
export * from "./registration";
export { telegramPublishingAdapter } from "./adapter";
