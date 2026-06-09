import type { CreateOrderRequest, CreateOrderResponse } from "@oreli/shared";
import { describe, expect, it } from "vitest";

import { CheckoutApiError, createOrderRequest } from "../features/checkout/api";
import type { FetchLike } from "../features/gift/api";

const REQUEST: CreateOrderRequest = {
  giftSessionId: "guest-1",
  productId: "prod-1",
  recipient: {
    name: "Camille Dupont",
    line1: "Rue des Brasseurs 12",
    postalCode: "1000",
    city: "Bruxelles",
    country: "BE",
  },
  deliveryDate: "2026-12-24T00:00:00.000Z",
};

const OK_RESPONSE: CreateOrderResponse = {
  order: {
    id: "order-1",
    giftSessionId: "guest-1",
    productId: "prod-1",
    amountCents: 4500,
    currency: "EUR",
    stripePaymentIntentId: "pi_test_1",
    status: "paid",
    recipient: REQUEST.recipient,
    deliveryDate: "2026-12-24T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  clientSecret: "pi_test_1_secret",
};

function stubFetch(
  response: Partial<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>,
  capture?: { url?: string; body?: string },
): FetchLike {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.body = init.body;
    }
    return {
      ok: response.ok ?? true,
      status: response.status ?? 201,
      json: response.json ?? (async () => OK_RESPONSE),
    };
  };
}

describe("createOrderRequest", () => {
  it("poste la demande et renvoie la réponse validée", async () => {
    const capture: { url?: string; body?: string } = {};
    const result = await createOrderRequest(REQUEST, {
      baseUrl: "http://api.test",
      fetchImpl: stubFetch({}, capture),
    });

    expect(result).toEqual(OK_RESPONSE);
    expect(capture.url).toBe("http://api.test/api/v1/checkout");
    expect(JSON.parse(capture.body ?? "{}").productId).toBe("prod-1");
  });

  it("traduit un code d'erreur métier en message lisible", async () => {
    await expect(
      createOrderRequest(REQUEST, {
        baseUrl: "http://api.test",
        fetchImpl: stubFetch({
          ok: false,
          status: 409,
          json: async () => ({ code: "product_out_of_stock" }),
        }),
      }),
    ).rejects.toMatchObject({ code: "product_out_of_stock" });
  });

  it("lève CheckoutApiError sur un statut non-2xx sans corps lisible", async () => {
    await expect(
      createOrderRequest(REQUEST, {
        baseUrl: "http://api.test",
        fetchImpl: stubFetch({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error("pas de corps");
          },
        }),
      }),
    ).rejects.toBeInstanceOf(CheckoutApiError);
  });

  it("lève CheckoutApiError quand la réponse ne respecte pas le contrat", async () => {
    await expect(
      createOrderRequest(REQUEST, {
        baseUrl: "http://api.test",
        fetchImpl: stubFetch({ json: async () => ({ order: 42 }) }),
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("lève CheckoutApiError en cas d'échec réseau", async () => {
    const failing: FetchLike = async () => {
      throw new Error("offline");
    };
    await expect(
      createOrderRequest(REQUEST, {
        baseUrl: "http://api.test",
        fetchImpl: failing,
      }),
    ).rejects.toMatchObject({ code: "network_error" });
  });
});
