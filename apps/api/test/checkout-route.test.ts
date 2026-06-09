import { API_PREFIX, createOrderResponseSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type {
  CheckoutProduct,
  OrderRepository,
  PaymentGateway,
  ProductLookup,
} from "../src/checkout/service";

const DATE = new Date("2026-06-01T00:00:00.000Z");

function productLookup(product: CheckoutProduct | null): ProductLookup {
  return {
    async findById(id) {
      return product !== null && product.id === id ? product : null;
    },
  };
}

function orderRepository(): OrderRepository {
  return {
    async create(order) {
      return { ...order, id: "order-1", createdAt: DATE };
    },
  };
}

function paymentGateway(status = "succeeded"): PaymentGateway {
  return {
    async createPaymentIntent() {
      return { id: "pi_test_1", clientSecret: "pi_test_1_secret", status };
    },
  };
}

function appWith(product: CheckoutProduct | null) {
  return createApp({
    productLookup: productLookup(product),
    orderRepository: orderRepository(),
    paymentGateway: paymentGateway(),
  });
}

function validBody() {
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
  };
}

function makeProduct(overrides: Partial<CheckoutProduct> = {}): CheckoutProduct {
  return {
    id: "prod-1",
    priceCents: 4500,
    currency: "EUR",
    inStock: true,
    ...overrides,
  };
}

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request(`${API_PREFIX}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/checkout", () => {
  it("crée la commande et renvoie 201 avec une réponse conforme au schéma", async () => {
    const app = appWith(makeProduct());

    const res = await post(app, validBody());

    expect(res.status).toBe(201);
    const parsed = createOrderResponseSchema.parse(await res.json());
    expect(parsed.order.amountCents).toBe(4500);
    expect(parsed.order.status).toBe("paid");
    expect(parsed.clientSecret).toBe("pi_test_1_secret");
  });

  it("renvoie 404 product_not_found pour un produit inconnu", async () => {
    const app = appWith(null);

    const res = await post(app, validBody());

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("product_not_found");
  });

  it("renvoie 409 product_out_of_stock pour un produit épuisé", async () => {
    const app = appWith(makeProduct({ inStock: false }));

    const res = await post(app, validBody());

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("product_out_of_stock");
  });

  it("rejette un corps invalide avec une ApiError 400", async () => {
    const app = appWith(makeProduct());

    const res = await post(app, { ...validBody(), recipient: { name: "x" } });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });

  it("rejette un JSON malformé avec une ApiError 400", async () => {
    const app = appWith(makeProduct());

    const res = await app.request(`${API_PREFIX}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ pas du json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });

  it("renvoie 502 payment_error quand la passerelle échoue", async () => {
    const app = createApp({
      productLookup: productLookup(makeProduct()),
      orderRepository: orderRepository(),
      paymentGateway: {
        async createPaymentIntent() {
          throw new Error("Stripe a répondu 500");
        },
      },
    });

    const res = await post(app, validBody());

    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("payment_error");
  });
});
