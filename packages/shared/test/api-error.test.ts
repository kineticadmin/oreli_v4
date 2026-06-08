import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  healthResponseSchema,
  makeApiError,
} from "../src/index";

describe("makeApiError", () => {
  it("crée une erreur sans détails", () => {
    const err = makeApiError("not_found", "Ressource introuvable");
    expect(err).toEqual({ code: "not_found", message: "Ressource introuvable" });
    expect(apiErrorSchema.parse(err)).toEqual(err);
  });

  it("inclut les détails quand ils sont fournis", () => {
    const err = makeApiError("validation_error", "Entrée invalide", {
      field: "budget",
    });
    expect(err.details).toEqual({ field: "budget" });
    expect(apiErrorSchema.safeParse(err).success).toBe(true);
  });
});

describe("healthResponseSchema", () => {
  it("valide une réponse de santé correcte", () => {
    const ok = healthResponseSchema.safeParse({
      status: "ok",
      service: "oreli-api",
      version: "0.0.0",
    });
    expect(ok.success).toBe(true);
  });

  it("rejette un statut inattendu", () => {
    const ko = healthResponseSchema.safeParse({
      status: "down",
      service: "oreli-api",
      version: "0.0.0",
    });
    expect(ko.success).toBe(false);
  });
});
