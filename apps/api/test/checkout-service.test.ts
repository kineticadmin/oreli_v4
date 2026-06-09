import type { CreateOrderRequest } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import {
  type CheckoutDeps,
  type CheckoutProduct,
  createCheckout,
  InvalidCheckoutError,
  type NewOrder,
  type OrderRepository,
  type PaymentGateway,
  type PaymentIntentResult,
  ProductNotFoundError,
  ProductOutOfStockError,
  PaymentGatewayError,
  type ProductLookup,
} from "../src/checkout/service";

const DATE = new Date("2026-06-01T00:00:00.000Z");

/** Produit par défaut : en stock, 4500 c. EUR. */
function makeProduct(
  overrides: Partial<CheckoutProduct> = {},
): CheckoutProduct {
  return {
    id: "prod-1",
    priceCents: 4500,
    currency: "EUR",
    inStock: true,
    ...overrides,
  };
}

/** Lecture produit en mémoire : un seul produit connu, sinon `null`. */
function productLookup(product: CheckoutProduct | null): ProductLookup {
  return {
    async findById(id) {
      return product !== null && product.id === id ? product : null;
    },
  };
}

/** Dépôt de commandes en mémoire : pose `id`/`createdAt` comme la base. */
function orderRepository(captured?: { order?: NewOrder }): OrderRepository {
  return {
    async create(order) {
      if (captured) {
        captured.order = order;
      }
      return { ...order, id: "order-1", createdAt: DATE };
    },
  };
}

/** Passerelle de paiement déterministe au statut paramétrable. */
function paymentGateway(
  result: Partial<PaymentIntentResult> = {},
  captured?: { amountCents?: number; currency?: string },
): PaymentGateway {
  return {
    async createPaymentIntent(input) {
      if (captured) {
        captured.amountCents = input.amountCents;
        captured.currency = input.currency;
      }
      return {
        id: result.id ?? "pi_test_123",
        clientSecret:
          "clientSecret" in result
            ? (result.clientSecret ?? null)
            : "pi_test_123_secret",
        status: result.status ?? "succeeded",
      };
    },
  };
}

/** Corps de requête valide par défaut, surchargeable. */
function makeRequest(
  overrides: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return {
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
    ...overrides,
  };
}

function makeDeps(
  partial: Partial<CheckoutDeps> = {},
): CheckoutDeps {
  return {
    products: partial.products ?? productLookup(makeProduct()),
    orders: partial.orders ?? orderRepository(),
    payments: partial.payments ?? paymentGateway(),
  };
}

describe("createCheckout", () => {
  it("crée une commande payée avec le montant autoritaire du produit", async () => {
    const captured: { order?: NewOrder } = {};
    const deps = makeDeps({ orders: orderRepository(captured) });

    const result = await createCheckout(deps, makeRequest());

    expect(result.order.id).toBe("order-1");
    expect(result.order.amountCents).toBe(4500);
    expect(result.order.currency).toBe("EUR");
    expect(result.order.status).toBe("paid");
    expect(result.order.stripePaymentIntentId).toBe("pi_test_123");
    expect(result.clientSecret).toBe("pi_test_123_secret");
    // Le statut « paid » dérive du PaymentIntent, jamais d'une entrée client.
    expect(captured.order?.status).toBe("paid");
  });

  it("transmet à Stripe le montant et la devise issus du produit", async () => {
    const captured: { amountCents?: number; currency?: string } = {};
    const deps = makeDeps({
      products: productLookup(makeProduct({ priceCents: 7800 })),
      payments: paymentGateway({}, captured),
    });

    const result = await createCheckout(deps, makeRequest());

    expect(captured.amountCents).toBe(7800);
    expect(captured.currency).toBe("EUR");
    expect(result.order.amountCents).toBe(7800);
  });

  it("persiste les coordonnées de livraison sans les altérer", async () => {
    const captured: { order?: NewOrder } = {};
    const deps = makeDeps({ orders: orderRepository(captured) });

    const result = await createCheckout(deps, makeRequest());

    expect(result.order.recipient.name).toBe("Camille Dupont");
    expect(result.order.recipient.city).toBe("Bruxelles");
    expect(captured.order?.deliveryDate.toISOString()).toBe(
      "2026-12-24T00:00:00.000Z",
    );
  });

  it("marque la commande « pending » quand le paiement n'a pas abouti", async () => {
    const deps = makeDeps({
      payments: paymentGateway({ status: "processing", clientSecret: null }),
    });

    const result = await createCheckout(deps, makeRequest());

    expect(result.order.status).toBe("pending");
    expect(result.clientSecret).toBeNull();
  });

  it("marque la commande « failed » quand la carte est refusée", async () => {
    const deps = makeDeps({
      payments: paymentGateway({ status: "requires_payment_method" }),
    });

    const result = await createCheckout(deps, makeRequest());

    expect(result.order.status).toBe("failed");
  });

  it("lève ProductNotFoundError pour un produit inconnu", async () => {
    const deps = makeDeps({ products: productLookup(null) });

    await expect(createCheckout(deps, makeRequest())).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it("lève ProductOutOfStockError pour un produit épuisé", async () => {
    const deps = makeDeps({
      products: productLookup(makeProduct({ inStock: false })),
    });

    await expect(createCheckout(deps, makeRequest())).rejects.toBeInstanceOf(
      ProductOutOfStockError,
    );
  });

  it("ne crée aucun PaymentIntent si le produit est introuvable", async () => {
    let called = false;
    const deps = makeDeps({
      products: productLookup(null),
      payments: {
        async createPaymentIntent() {
          called = true;
          return { id: "x", clientSecret: null, status: "succeeded" };
        },
      },
    });

    await expect(createCheckout(deps, makeRequest())).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(called).toBe(false);
  });

  it("enveloppe un échec de la passerelle dans PaymentGatewayError", async () => {
    const deps = makeDeps({
      payments: {
        async createPaymentIntent() {
          throw new Error("réseau Stripe indisponible");
        },
      },
    });

    await expect(createCheckout(deps, makeRequest())).rejects.toBeInstanceOf(
      PaymentGatewayError,
    );
  });

  it("lève InvalidCheckoutError sur des coordonnées de livraison manquantes", async () => {
    const deps = makeDeps();
    const invalid = {
      ...makeRequest(),
      recipient: { name: "Sans adresse" },
    } as unknown as CreateOrderRequest;

    await expect(createCheckout(deps, invalid)).rejects.toBeInstanceOf(
      InvalidCheckoutError,
    );
  });
});
