import {
  type GiftSessionState,
  giftConverseResponseSchema,
} from "@oreli/shared";
import { describe, expect, it } from "vitest";
import {
  converse,
  type ConverseDeps,
  GiftModelError,
  InvalidGiftStateError,
} from "../src/gift/service";
import { makeInMemoryCandidateRepository, makeRecord, makeStubGiftModel } from "./helpers";

const DATE = new Date("2026-06-01T00:00:00.000Z");

/** Candidats par défaut : tous dans le budget, en stock, occasion correspondante. */
function defaultCandidateRepo() {
  return makeInMemoryCandidateRepository([
    makeRecord({ id: "a", priceCents: 2000, createdAt: DATE }),
    makeRecord({ id: "b", priceCents: 2500, createdAt: DATE }),
    makeRecord({ id: "c", priceCents: 3000, createdAt: DATE }),
    makeRecord({ id: "d", priceCents: 3500, createdAt: DATE }),
    makeRecord({ id: "hors-budget", priceCents: 99999, createdAt: DATE }),
  ]);
}

/** État de session valide par défaut, surchargeable par test. */
function makeState(overrides: Partial<GiftSessionState> = {}): GiftSessionState {
  return {
    guestToken: "guest-1",
    budgetMinCents: 1000,
    budgetMaxCents: 5000,
    occasion: "anniversaire",
    eventDate: "2026-12-24T00:00:00.000Z",
    mode: "selection",
    recipient: { tastes: ["lecture", "thé"] },
    messages: [{ role: "user", content: "Un cadeau pour mon amie." }],
    ...overrides,
  };
}

function makeDeps(raw: unknown): ConverseDeps {
  return {
    candidateRepository: defaultCandidateRepo(),
    model: makeStubGiftModel(raw),
  };
}

describe("converse", () => {
  it("relaie le message d'Oreli sans proposition tant que readyToSuggest est faux", async () => {
    const deps = makeDeps({
      reply: "Quel est son univers ?",
      readyToSuggest: false,
      mode: "selection",
    });

    const result = await converse(deps, makeState());

    expect(result.reply).toBe("Quel est son univers ?");
    expect(result.readyToSuggest).toBe(false);
    expect(result.shortlist).toBeNull();
    expect(result.surprise).toBeNull();
    expect(giftConverseResponseSchema.parse(result)).toEqual(result);
  });

  it("renvoie une short list de produits en mode selection", async () => {
    const deps = makeDeps({
      reply: "Voici trois idées.",
      readyToSuggest: true,
      mode: "selection",
      productIds: ["a", "b", "c"],
    });

    const result = await converse(deps, makeState());

    expect(result.surprise).toBeNull();
    expect(result.shortlist?.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(giftConverseResponseSchema.parse(result)).toEqual(result);
  });

  it("renvoie un unique produit en mode surprise, sans liste", async () => {
    const deps = makeDeps({
      reply: "J'ai trouvé la perle rare.",
      readyToSuggest: true,
      mode: "surprise",
      productIds: ["b", "c"],
    });

    const result = await converse(deps, makeState({ mode: "surprise" }));

    expect(result.shortlist).toBeNull();
    expect(result.surprise?.id).toBe("b");
  });

  it("ignore les identifiants absents des candidats (anti-hallucination)", async () => {
    const deps = makeDeps({
      reply: "Voici ma sélection.",
      readyToSuggest: true,
      mode: "selection",
      productIds: ["a", "inexistant", "hors-budget", "c"],
    });

    const result = await converse(deps, makeState());

    expect(result.shortlist?.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("borne la short list à SHORTLIST_MAX produits", async () => {
    const deps = makeDeps({
      reply: "Beaucoup d'idées.",
      readyToSuggest: true,
      mode: "selection",
      productIds: ["a", "b", "c", "d", "a", "b"],
    });

    const result = await converse(deps, makeState());

    expect(result.shortlist).toHaveLength(5);
  });

  it("renvoie une surprise nulle si aucun identifiant proposé n'est valide", async () => {
    const deps = makeDeps({
      reply: "Surprise.",
      readyToSuggest: true,
      mode: "surprise",
      productIds: ["inexistant"],
    });

    const result = await converse(deps, makeState({ mode: "surprise" }));

    expect(result.surprise).toBeNull();
  });

  it("lève GiftModelError quand la sortie du modèle ne respecte pas le contrat", async () => {
    const deps = makeDeps({ reply: "Oups", readyToSuggest: "peut-être" });

    await expect(converse(deps, makeState())).rejects.toBeInstanceOf(
      GiftModelError,
    );
  });

  it("lève GiftModelError quand le modèle renvoie un champ hors contrat", async () => {
    const deps = makeDeps({
      reply: "Texte",
      readyToSuggest: false,
      mode: "selection",
      champInattendu: true,
    });

    await expect(converse(deps, makeState())).rejects.toBeInstanceOf(
      GiftModelError,
    );
  });

  it("lève InvalidGiftStateError sur un budget incohérent", async () => {
    const deps = makeDeps({
      reply: "x",
      readyToSuggest: false,
      mode: "selection",
    });

    await expect(
      converse(deps, makeState({ budgetMinCents: 9000, budgetMaxCents: 1000 })),
    ).rejects.toBeInstanceOf(InvalidGiftStateError);
  });

  it("rejette un profil destinataire contenant un champ identifiant", async () => {
    const deps = makeDeps({
      reply: "x",
      readyToSuggest: false,
      mode: "selection",
    });

    const withPii = {
      ...makeState(),
      recipient: { tastes: ["thé"], name: "Camille" },
    } as unknown as GiftSessionState;

    await expect(converse(deps, withPii)).rejects.toBeInstanceOf(
      InvalidGiftStateError,
    );
  });
});
