import type { GiftConverseResponse, GiftSessionState, Order, Product } from "@oreli/shared";
import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENTS,
  giftSelectedEvent,
  giftSessionStartedEvent,
  oreliSuggestedEvent,
  orderCompletedEvent,
} from "../features/analytics/events";

const STATE: GiftSessionState = {
  guestToken: "guest-1",
  budgetMinCents: 2000,
  budgetMaxCents: 6000,
  occasion: "anniversaire",
  eventDate: "2026-12-24T00:00:00.000Z",
  mode: "selection",
  recipient: { tastes: ["thé", "céramique"] },
  messages: [{ role: "user", content: "Un cadeau doux." }],
};

const PRODUCT: Product = {
  id: "prod-1",
  vendorId: "vendor-1",
  title: "Théière en grès",
  description: "Pièce d'artisan.",
  priceCents: 4500,
  currency: "EUR",
  imageUrl: "https://example.com/img.jpg",
  tags: ["thé"],
  occasionTags: ["anniversaire"],
  inStock: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

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

describe("giftSessionStartedEvent", () => {
  it("porte le jeton invité et des propriétés de catégorie", () => {
    const event = giftSessionStartedEvent(STATE);
    expect(event.name).toBe(ANALYTICS_EVENTS.giftSessionStarted);
    expect(event.distinctId).toBe("guest-1");
    expect(event.properties).toEqual({
      mode: "selection",
      occasion: "anniversaire",
      budgetMinCents: 2000,
      budgetMaxCents: 6000,
      tastesCount: 2,
    });
  });
});

describe("oreliSuggestedEvent", () => {
  it("compte les éléments d'une short list de sélection", () => {
    const response: GiftConverseResponse = {
      reply: "Voici ma sélection.",
      readyToSuggest: true,
      mode: "selection",
      shortlist: [PRODUCT, { ...PRODUCT, id: "prod-2" }, { ...PRODUCT, id: "prod-3" }],
      surprise: null,
    };
    const event = oreliSuggestedEvent("guest-1", response);
    expect(event.name).toBe(ANALYTICS_EVENTS.oreliSuggested);
    expect(event.properties).toEqual({ mode: "selection", suggestionCount: 3 });
  });

  it("compte un seul produit en mode surprise", () => {
    const response: GiftConverseResponse = {
      reply: "Votre surprise.",
      readyToSuggest: true,
      mode: "surprise",
      shortlist: null,
      surprise: PRODUCT,
    };
    const event = oreliSuggestedEvent("guest-1", response);
    expect(event.properties).toEqual({ mode: "surprise", suggestionCount: 1 });
  });
});

describe("giftSelectedEvent", () => {
  it("porte le produit retenu sans donnée identifiante", () => {
    const event = giftSelectedEvent("guest-1", PRODUCT);
    expect(event.name).toBe(ANALYTICS_EVENTS.giftSelected);
    expect(event.properties).toEqual({
      productId: "prod-1",
      priceCents: 4500,
      currency: "EUR",
    });
  });
});

describe("orderCompletedEvent", () => {
  it("porte le montant et le produit, jamais les coordonnées du destinataire", () => {
    const event = orderCompletedEvent("guest-1", ORDER);
    expect(event.name).toBe(ANALYTICS_EVENTS.orderCompleted);
    expect(event.properties).toEqual({
      orderId: "order-1",
      productId: "prod-1",
      amountCents: 4500,
      currency: "EUR",
      status: "paid",
    });
    // Garde-fou de confidentialité : aucune donnée identifiante ne fuit.
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("Camille");
    expect(serialized).not.toContain("Brasseurs");
    expect(serialized).not.toContain("Bruxelles");
  });
});
