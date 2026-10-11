/**
 * Store connector contract (PREP ONLY — no live store code).
 *
 * Defines the common interface every future channel connector must implement
 * (TikTok Shop, Google Merchant Center, Shopify, Meta commerce, Amazon, eBay,
 * Etsy, WooCommerce). Implementations come later, behind HUMAN_REQUIRED
 * account/approval/credential steps; this file only fixes the shape.
 *
 * Canonical-catalog principle: GEM keeps ONE canonical catalog
 * (today: src/lib/storeCatalog.ts + src/lib/storefrontCatalog.ts, served by
 * src/app/api/store/catalog/route.ts and
 * src/app/api/tokmetric/shop/catalog/route.ts). Each channel gets a
 * projection of that canonical catalog — connectors translate, never fork.
 */

export const storeConnectorMethodNames = [
  "connect",
  "authorize",
  "syncCatalog",
  "createOrUpdateProduct",
  "updatePrice",
  "updateAvailability",
  "syncInventory",
  "readOrders",
  "readConversions",
  "readChannelStatus",
  "handleWebhook",
  "refreshAuth",
  "disconnect",
] as const;

export type StoreConnectorMethodName =
  (typeof storeConnectorMethodNames)[number];

/** Channel identifiers covered by the readiness table. */
export const commerceChannelIds = [
  "tiktok_shop",
  "google_merchant_center",
  "shopify",
  "meta_commerce",
  "amazon",
  "ebay",
  "etsy",
  "woocommerce",
] as const;

export type CommerceChannelId = (typeof commerceChannelIds)[number];

/** Lifecycle state of a channel connector. */
export type StoreConnectorState =
  | "NOT_CONFIGURED"
  | "CONFIGURATION_REQUIRED"
  | "APPROVAL_REQUIRED"
  | "AUTHORIZATION_REQUIRED"
  | "CONNECTED"
  | "TOKEN_EXPIRED"
  | "DISABLED";

/** Why a product (or the whole channel) is not eligible for a channel. */
export type ChannelEligibilityRejectionReason =
  | "PRODUCT_TYPE_NOT_SUPPORTED"
  | "SERVICE_NOT_SELLABLE_ON_CHANNEL"
  | "REGION_NOT_SUPPORTED"
  | "CATEGORY_RESTRICTED"
  | "APPROVAL_NOT_GRANTED"
  | "MISSING_REQUIRED_ATTRIBUTE"
  | "PRICE_OUT_OF_RANGE"
  | "ACCOUNT_NOT_VERIFIED";

export interface ChannelEligibility {
  channelId: CommerceChannelId;
  eligible: boolean;
  rejectionReasons: ChannelEligibilityRejectionReason[];
  notes: string;
}

/** Minimal canonical product shape (the canonical catalog owns the full type). */
export interface CanonicalProductRef {
  slug: string;
  name: string;
  priceLabel: string;
}

/** Channel-specific projection of a canonical product. */
export interface ChannelProductProjection {
  channelId: CommerceChannelId;
  canonicalSlug: string;
  channelProductId?: string;
  eligibility: ChannelEligibility;
}

export interface StoreConnectorContext {
  workspaceId: string;
  channelId: CommerceChannelId;
}

export interface StoreConnectorAuthResult {
  ok: boolean;
  state: StoreConnectorState;
  /** Safe, non-secret summary (never tokens). */
  accountSummary?: Record<string, unknown>;
}

export interface StoreConnectorOperationResult {
  ok: boolean;
  channelIds: string[];
  /** Safe metadata only — never credentials. */
  safeMetadata?: Record<string, unknown>;
}

export interface StoreConnectorError {
  code: string;
  message: string;
  retryable: boolean;
  reauthorizationRequired?: boolean;
}

export interface ChannelStatusReport {
  channelId: CommerceChannelId;
  state: StoreConnectorState;
  eligibleProducts: number;
  ineligibleProducts: number;
  rejectionBreakdown: Partial<
    Record<ChannelEligibilityRejectionReason, number>
  >;
  lastSyncedAt?: string;
  safeDetails?: Record<string, unknown>;
}

/**
 * The common store connector contract. All thirteen operations must be
 * present on every implementation; unimplemented operations fail closed
 * (return { ok: false } / throw a StoreConnectorError) rather than faking
 * success.
 */
export interface StoreConnector {
  /** CONNECT: validate stored config and reach the channel's API. */
  connect(context: StoreConnectorContext): Promise<StoreConnectorAuthResult>;

  /** AUTHORIZE: complete/verify the channel's auth flow (OAuth, keys). HUMAN_REQUIRED. */
  authorize(context: StoreConnectorContext): Promise<StoreConnectorAuthResult>;

  /** SYNC_CATALOG: push canonical-catalog projections to the channel. */
  syncCatalog(
    context: StoreConnectorContext,
    products: CanonicalProductRef[],
  ): Promise<StoreConnectorOperationResult>;

  /** CREATE_UPDATE_PRODUCT: upsert one channel projection. */
  createOrUpdateProduct(
    context: StoreConnectorContext,
    projection: ChannelProductProjection,
  ): Promise<StoreConnectorOperationResult>;

  /** UPDATE_PRICE: change price for a channel listing. */
  updatePrice(
    context: StoreConnectorContext,
    input: { channelProductId: string; priceLabel: string },
  ): Promise<StoreConnectorOperationResult>;

  /** UPDATE_AVAILABILITY: change sellable status for a channel listing. */
  updateAvailability(
    context: StoreConnectorContext,
    input: { channelProductId: string; available: boolean },
  ): Promise<StoreConnectorOperationResult>;

  /** SYNC_INVENTORY: push stock levels (no-op for service products). */
  syncInventory(
    context: StoreConnectorContext,
    input: { channelProductId: string; quantity: number }[],
  ): Promise<StoreConnectorOperationResult>;

  /** READ_ORDERS: pull channel orders for reconciliation (read-only). */
  readOrders(
    context: StoreConnectorContext,
    input: { since?: string; limit?: number },
  ): Promise<{ orders: unknown[]; safeMetadata?: Record<string, unknown> }>;

  /** READ_CONVERSIONS: pull channel conversion/attribution data (read-only). */
  readConversions(
    context: StoreConnectorContext,
    input: { since?: string },
  ): Promise<{ conversions: unknown[]; safeMetadata?: Record<string, unknown> }>;

  /** READ_CHANNEL_STATUS: connection health + eligibility summary. */
  readChannelStatus(
    context: StoreConnectorContext,
  ): Promise<ChannelStatusReport>;

  /** HANDLE_WEBHOOK: verify signature and route a channel webhook event. */
  handleWebhook(
    context: StoreConnectorContext,
    input: { headers: Record<string, string>; rawBody: string },
  ): Promise<{ handled: boolean; safeMetadata?: Record<string, unknown> }>;

  /** REFRESH_AUTH: rotate/refresh channel credentials server-side. */
  refreshAuth(context: StoreConnectorContext): Promise<StoreConnectorAuthResult>;

  /** DISCONNECT: revoke and purge channel credentials server-side. */
  disconnect(context: StoreConnectorContext): Promise<StoreConnectorAuthResult>;
}

/**
 * Fail-closed stub factory: returns a StoreConnector whose every operation
 * reports NOT_CONFIGURED. Useful as the default until a real channel
 * implementation lands — it can never fake a successful sync.
 */
export function notConfiguredStoreConnector(
  channelId: CommerceChannelId,
): StoreConnector {
  const notConfigured = (): Promise<never> =>
    Promise.reject({
      code: "CHANNEL_NOT_CONFIGURED",
      message: `${channelId} is not configured. Owner setup is required.`,
      retryable: false,
    } satisfies StoreConnectorError);
  return {
    connect: () =>
      Promise.resolve({ ok: false, state: "NOT_CONFIGURED" as const }),
    authorize: notConfigured,
    syncCatalog: notConfigured,
    createOrUpdateProduct: notConfigured,
    updatePrice: notConfigured,
    updateAvailability: notConfigured,
    syncInventory: notConfigured,
    readOrders: notConfigured,
    readConversions: notConfigured,
    readChannelStatus: () =>
      Promise.resolve({
        channelId,
        state: "NOT_CONFIGURED" as const,
        eligibleProducts: 0,
        ineligibleProducts: 0,
        rejectionBreakdown: {},
      }),
    handleWebhook: notConfigured,
    refreshAuth: notConfigured,
    disconnect: () =>
      Promise.resolve({ ok: true, state: "NOT_CONFIGURED" as const }),
  };
}
