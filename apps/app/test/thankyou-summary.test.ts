import type { Order } from "@oreli/shared";
import { describe, expect, it } from "vitest";

import {
  decodeThankYouParams,
  encodeThankYouParams,
} from "../features/thankyou/summary";

const ORDER: Order = {
  id: "order-1",
  giftSessionId: "guest-1",
  productId: "prod-1",
  amountCents: 4500,
  currency: "EUR",
  stripePaymentIntentId: "pi_test_123",
  status: "paid",
  recipient: {
    name: "Camille Dupont",
    line1: "Rue des Brasseurs 12",
    postalCode: "1000",
    city: "Bruxelles",
    country: "BE",
  },
  deliveryDate: "2026-12-24T00:00:00.000Z",
  createdAt: "2026-06-10T00:00:00.000Z",
};

describe("encodeThankYouParams", () => {
  it("sérialise la commande sans donnée identifiante", () => {
    const params = encodeThankYouParams(ORDER);
    expect(params).toEqual({
      orderId: "order-1",
      amountCents: "4500",
      currency: "EUR",
      status: "paid",
      paymentIntentId: "pi_test_123",
    });
    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain("Camille");
    expect(serialized).not.toContain("Bruxelles");
  });
});

describe("decodeThankYouParams", () => {
  it("relit un résumé valide depuis les paramètres encodés", () => {
    const summary = decodeThankYouParams(encodeThankYouParams(ORDER));
    expect(summary).toEqual({
      orderId: "order-1",
      amountCents: 4500,
      currency: "EUR",
      status: "paid",
      paymentIntentId: "pi_test_123",
    });
  });

  it("tolère un paramètre fourni sous forme de tableau (Expo Router)", () => {
    const summary = decodeThankYouParams({
      orderId: ["order-2"],
      amountCents: ["1990"],
      currency: ["EUR"],
      status: ["pending"],
      paymentIntentId: ["pi_test_456"],
    });
    expect(summary?.orderId).toBe("order-2");
    expect(summary?.amountCents).toBe(1990);
    expect(summary?.status).toBe("pending");
  });

  it("renvoie null en l'absence de paramètres (accès direct à /merci)", () => {
    expect(decodeThankYouParams({})).toBeNull();
  });

  it("renvoie null sur un montant non entier", () => {
    expect(
      decodeThankYouParams({
        orderId: "order-1",
        amountCents: "abc",
        currency: "EUR",
        status: "paid",
        paymentIntentId: "pi_test_123",
      }),
    ).toBeNull();
  });

  it("renvoie null sur un statut hors contrat", () => {
    expect(
      decodeThankYouParams({
        orderId: "order-1",
        amountCents: "4500",
        currency: "EUR",
        status: "unknown",
        paymentIntentId: "pi_test_123",
      }),
    ).toBeNull();
  });
});
