/**
 * Store connector contract tests.
 *
 * Type completeness is proven at compile time: `fullContract` must assign
 * every one of the thirteen operations from `storeConnectorMethodNames` to the
 * `StoreConnector` interface, so tsc fails if the interface and the method
 * list drift apart.
 */
import { describe, expect, it } from "vitest";
import {
  commerceChannelIds,
  notConfiguredStoreConnector,
  storeConnectorMethodNames,
  type CommerceChannelId,
  type StoreConnector,
  type StoreConnectorMethodName,
} from "@/lib/commerce/connector-contract";

describe("store connector contract", () => {
  it("lists exactly the thirteen mandated operations", () => {
    expect(storeConnectorMethodNames).toEqual([
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
    ]);
  });

  it("covers all eight commerce channels", () => {
    expect(commerceChannelIds).toEqual([
      "tiktok_shop",
      "google_merchant_center",
      "shopify",
      "meta_commerce",
      "amazon",
      "ebay",
      "etsy",
      "woocommerce",
    ]);
  });

  it("is fully implemented by the fail-closed stub (compile-time + runtime)", () => {
    const channelId = "shopify" satisfies CommerceChannelId;
    // Compile-time: tsc requires all thirteen methods here.
    const fullContract: StoreConnector = notConfiguredStoreConnector(channelId);
    const nameToMethod: Record<StoreConnectorMethodName, keyof StoreConnector> =
      {
        connect: "connect",
        authorize: "authorize",
        syncCatalog: "syncCatalog",
        createOrUpdateProduct: "createOrUpdateProduct",
        updatePrice: "updatePrice",
        updateAvailability: "updateAvailability",
        syncInventory: "syncInventory",
        readOrders: "readOrders",
        readConversions: "readConversions",
        readChannelStatus: "readChannelStatus",
        handleWebhook: "handleWebhook",
        refreshAuth: "refreshAuth",
        disconnect: "disconnect",
      };
    for (const name of storeConnectorMethodNames) {
      expect(typeof fullContract[nameToMethod[name]]).toBe("function");
    }
  });

  it("fail-closed stub reports NOT_CONFIGURED and never fakes success", async () => {
    const stub = notConfiguredStoreConnector("tiktok_shop");
    const status = await stub.readChannelStatus({ workspaceId: "ws", channelId: "tiktok_shop" });
    expect(status.state).toBe("NOT_CONFIGURED");
    expect(status.eligibleProducts).toBe(0);

    await expect(
      stub.syncCatalog({ workspaceId: "ws", channelId: "tiktok_shop" }, []),
    ).rejects.toMatchObject({ code: "CHANNEL_NOT_CONFIGURED", retryable: false });

    const connectResult = await stub.connect({
      workspaceId: "ws",
      channelId: "tiktok_shop",
    });
    expect(connectResult).toMatchObject({ ok: false, state: "NOT_CONFIGURED" });
  });
});
