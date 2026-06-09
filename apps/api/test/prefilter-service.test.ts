import { productSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import {
  CANDIDATES_MAX,
  type CandidateFilter,
  type CandidateRepository,
  getCandidates,
  InvalidCandidateFilterError,
} from "../src/prefilter/service";
import { makeInMemoryCandidateRepository, makeRecord } from "./helpers";

/** Critère de pré-filtre valide par défaut, surchargeable par test. */
function makeFilter(overrides: Partial<CandidateFilter> = {}): CandidateFilter {
  return {
    budget: { minCents: 1000, maxCents: 5000 },
    occasion: "anniversaire",
    date: new Date("2026-12-24T00:00:00.000Z"),
    ...overrides,
  };
}

const DATE = new Date("2026-06-01T00:00:00.000Z");

describe("getCandidates", () => {
  it("ne retient que les produits dans la borne de budget (inclusive)", async () => {
    const repo = makeInMemoryCandidateRepository([
      makeRecord({ id: "trop-bas", priceCents: 999, createdAt: DATE }),
      makeRecord({ id: "borne-basse", priceCents: 1000, createdAt: DATE }),
      makeRecord({ id: "borne-haute", priceCents: 5000, createdAt: DATE }),
      makeRecord({ id: "trop-haut", priceCents: 5001, createdAt: DATE }),
    ]);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates.map((p) => p.id).sort()).toEqual([
      "borne-basse",
      "borne-haute",
    ]);
  });

  it("exclut les produits hors stock", async () => {
    const repo = makeInMemoryCandidateRepository([
      makeRecord({ id: "dispo", inStock: true, createdAt: DATE }),
      makeRecord({ id: "epuise", inStock: false, createdAt: DATE }),
    ]);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates.map((p) => p.id)).toEqual(["dispo"]);
  });

  it("exige au moins un occasionTags correspondant", async () => {
    const repo = makeInMemoryCandidateRepository([
      makeRecord({
        id: "match",
        occasionTags: ["noel", "anniversaire"],
        createdAt: DATE,
      }),
      makeRecord({
        id: "hors-occasion",
        occasionTags: ["mariage"],
        createdAt: DATE,
      }),
    ]);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates.map((p) => p.id)).toEqual(["match"]);
  });

  it("expose des produits conformes au contrat public", async () => {
    const repo = makeInMemoryCandidateRepository([
      makeRecord({ id: "a", createdAt: DATE }),
    ]);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates).toHaveLength(1);
    for (const item of candidates) {
      expect(productSchema.parse(item)).toEqual(item);
    }
  });

  it("borne le nombre de candidats à CANDIDATES_MAX", async () => {
    const records = Array.from({ length: CANDIDATES_MAX + 5 }, (_, i) =>
      makeRecord({
        id: `p-${String(i).padStart(2, "0")}`,
        createdAt: new Date(2026, 0, 1 + i),
      }),
    );
    const repo = makeInMemoryCandidateRepository(records);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates).toHaveLength(CANDIDATES_MAX);
  });

  it("garantit la borne même si le dépôt en renvoie davantage", async () => {
    const tooMany: CandidateRepository = {
      async findCandidates() {
        return Array.from({ length: CANDIDATES_MAX + 10 }, (_, i) =>
          makeRecord({ id: `q-${i}`, createdAt: DATE }),
        );
      },
    };

    const candidates = await getCandidates(tooMany, makeFilter());

    expect(candidates).toHaveLength(CANDIDATES_MAX);
  });

  it("renvoie une liste vide quand rien ne correspond", async () => {
    const repo = makeInMemoryCandidateRepository([
      makeRecord({ id: "hors-budget", priceCents: 99999, createdAt: DATE }),
    ]);

    const candidates = await getCandidates(repo, makeFilter());

    expect(candidates).toEqual([]);
  });

  it("rejette un budget dont le minimum dépasse le maximum", async () => {
    const repo = makeInMemoryCandidateRepository([]);

    await expect(
      getCandidates(repo, makeFilter({ budget: { minCents: 5000, maxCents: 1000 } })),
    ).rejects.toBeInstanceOf(InvalidCandidateFilterError);
  });

  it("rejette une occasion vide", async () => {
    const repo = makeInMemoryCandidateRepository([]);

    await expect(
      getCandidates(repo, makeFilter({ occasion: "" })),
    ).rejects.toBeInstanceOf(InvalidCandidateFilterError);
  });
});
