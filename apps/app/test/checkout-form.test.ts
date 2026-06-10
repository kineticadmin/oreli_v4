import { describe, expect, it } from "vitest";

import {
  buildOrderRequest,
  type DeliveryForm,
  formatAmount,
} from "../features/checkout/form";

function makeForm(overrides: Partial<DeliveryForm> = {}): DeliveryForm {
  return {
    name: "Camille Dupont",
    line1: "Rue des Brasseurs 12",
    line2: "",
    postalCode: "1000",
    city: "Bruxelles",
    deliveryDate: "2026-12-24",
    ...overrides,
  };
}

describe("buildOrderRequest", () => {
  it("assemble une requête valide à partir d'une saisie complète", () => {
    const result = buildOrderRequest(makeForm(), "guest-1", "prod-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.request.giftSessionId).toBe("guest-1");
    expect(result.request.productId).toBe("prod-1");
    expect(result.request.recipient.name).toBe("Camille Dupont");
    expect(result.request.recipient.country).toBe("BE");
    expect(result.request.deliveryDate).toBe("2026-12-24T00:00:00.000Z");
  });

  it("omet le complément d'adresse vide et le conserve sinon", () => {
    const sans = buildOrderRequest(makeForm(), "guest-1", "prod-1");
    expect(sans.ok && sans.request.recipient.line2).toBeUndefined();

    const avec = buildOrderRequest(
      makeForm({ line2: "Boîte 3" }),
      "guest-1",
      "prod-1",
    );
    expect(avec.ok && avec.request.recipient.line2).toBe("Boîte 3");
  });

  it("rejette les champs obligatoires manquants", () => {
    const result = buildOrderRequest(
      makeForm({ name: "  ", line1: "", postalCode: "", city: "" }),
      "guest-1",
      "prod-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("rejette une date de livraison invalide", () => {
    const result = buildOrderRequest(
      makeForm({ deliveryDate: "24-12-2026" }),
      "guest-1",
      "prod-1",
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((e) => e.includes("Date de livraison"))).toBe(
      true,
    );
  });
});

describe("formatAmount", () => {
  it("formate les euros avec une virgule décimale", () => {
    expect(formatAmount(4500, "EUR")).toBe("45,00 €");
    expect(formatAmount(799, "EUR")).toBe("7,99 €");
  });

  it("retombe sur le code devise pour une devise non-EUR", () => {
    expect(formatAmount(1000, "usd")).toBe("10,00 USD");
  });
});
