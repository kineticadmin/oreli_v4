import { describe, expect, it } from "vitest";

import {
  appendMessage,
  buildSessionState,
  createGuestToken,
  eurosToCents,
  type GiftSetupForm,
  isoFromDateInput,
  parseTastes,
} from "../features/gift/session";

const VALID_FORM: GiftSetupForm = {
  budgetMin: "20",
  budgetMax: "60",
  occasion: "anniversaire",
  eventDate: "2026-12-24",
  mode: "selection",
  relationship: "une amie proche",
  tastes: "thé, lecture",
  tone: "tendre",
};

describe("eurosToCents", () => {
  it("convertit un entier d'euros en centiers", () => {
    expect(eurosToCents("45")).toBe(4500);
  });

  it("tolère la virgule décimale (locale belge)", () => {
    expect(eurosToCents("19,99")).toBe(1999);
  });

  it("tolère le point décimal et les espaces", () => {
    expect(eurosToCents("  12.50 ")).toBe(1250);
  });

  it("rejette une saisie non numérique ou à trois décimales", () => {
    expect(eurosToCents("abc")).toBeNull();
    expect(eurosToCents("12,999")).toBeNull();
    expect(eurosToCents("")).toBeNull();
  });
});

describe("parseTastes", () => {
  it("découpe et nettoie une liste séparée par des virgules", () => {
    expect(parseTastes("thé,  lecture , céramique")).toEqual([
      "thé",
      "lecture",
      "céramique",
    ]);
  });

  it("ignore les entrées vides", () => {
    expect(parseTastes(" , ,")).toEqual([]);
  });
});

describe("isoFromDateInput", () => {
  it("convertit une date AAAA-MM-JJ en ISO 8601 (minuit UTC)", () => {
    expect(isoFromDateInput("2026-12-24")).toBe("2026-12-24T00:00:00.000Z");
  });

  it("rejette un mauvais format", () => {
    expect(isoFromDateInput("24/12/2026")).toBeNull();
    expect(isoFromDateInput("2026-12")).toBeNull();
  });

  it("rejette une date impossible", () => {
    expect(isoFromDateInput("2026-02-30")).toBeNull();
    expect(isoFromDateInput("2026-13-01")).toBeNull();
  });
});

describe("createGuestToken", () => {
  it("produit un jeton invité non vide et préfixé", () => {
    const token = createGuestToken();
    expect(token.startsWith("guest-")).toBe(true);
    expect(token.length).toBeGreaterThan("guest-".length);
  });
});

describe("buildSessionState", () => {
  it("assemble un état valide à partir d'une saisie correcte", () => {
    const result = buildSessionState(VALID_FORM, "guest-1", "Un cadeau doux.");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("attendu : état valide");
    }
    expect(result.state.budgetMinCents).toBe(2000);
    expect(result.state.budgetMaxCents).toBe(6000);
    expect(result.state.eventDate).toBe("2026-12-24T00:00:00.000Z");
    expect(result.state.recipient.tastes).toEqual(["thé", "lecture"]);
    expect(result.state.recipient.relationship).toBe("une amie proche");
    expect(result.state.messages).toEqual([
      { role: "user", content: "Un cadeau doux." },
    ]);
  });

  it("omet les attributs optionnels laissés vides", () => {
    const result = buildSessionState(
      { ...VALID_FORM, relationship: "  ", tone: "", tastes: "" },
      "guest-1",
      "Un cadeau doux.",
    );
    if (!result.ok) {
      throw new Error("attendu : état valide");
    }
    expect(result.state.recipient.relationship).toBeUndefined();
    expect(result.state.recipient.tone).toBeUndefined();
    expect(result.state.recipient.tastes).toEqual([]);
  });

  it("signale un budget incohérent", () => {
    const result = buildSessionState(
      { ...VALID_FORM, budgetMin: "80", budgetMax: "20" },
      "guest-1",
      "Bonjour",
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("attendu : échec");
    }
    expect(result.errors.some((e) => e.includes("budget"))).toBe(true);
  });

  it("rassemble plusieurs erreurs de saisie", () => {
    const result = buildSessionState(
      { ...VALID_FORM, budgetMax: "x", eventDate: "hier", occasion: "" },
      "guest-1",
      "",
    );
    if (result.ok) {
      throw new Error("attendu : échec");
    }
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("exige un premier message", () => {
    const result = buildSessionState(VALID_FORM, "guest-1", "   ");
    expect(result.ok).toBe(false);
  });
});

describe("appendMessage", () => {
  it("ajoute un tour sans muter l'état d'origine", () => {
    const built = buildSessionState(VALID_FORM, "guest-1", "Bonjour Oreli.");
    if (!built.ok) {
      throw new Error("attendu : état valide");
    }
    const next = appendMessage(built.state, "oreli", "Pour quelle occasion ?");
    expect(next.messages).toHaveLength(2);
    expect(next.messages[1]).toEqual({
      role: "oreli",
      content: "Pour quelle occasion ?",
    });
    // L'état d'origine reste inchangé (immutabilité).
    expect(built.state.messages).toHaveLength(1);
  });
});
