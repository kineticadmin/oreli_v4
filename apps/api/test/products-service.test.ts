import { PRODUCTS_DEFAULT_LIMIT, productSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import { listProducts } from "../src/products/service";
import { makeInMemoryRepository, makeRecord } from "./helpers";

/** Cinq produits horodatés du plus récent (e) au plus ancien (a). */
function fixtureRecords() {
  return [
    makeRecord({ id: "a", createdAt: new Date("2026-06-01T00:00:00.000Z") }),
    makeRecord({ id: "b", createdAt: new Date("2026-06-02T00:00:00.000Z") }),
    makeRecord({ id: "c", createdAt: new Date("2026-06-03T00:00:00.000Z") }),
    makeRecord({ id: "d", createdAt: new Date("2026-06-04T00:00:00.000Z") }),
    makeRecord({ id: "e", createdAt: new Date("2026-06-05T00:00:00.000Z") }),
  ];
}

describe("listProducts", () => {
  it("ordonne du plus récent au plus ancien et expose des produits sérialisés", async () => {
    const repo = makeInMemoryRepository(fixtureRecords());
    const page = await listProducts(repo, { limit: 10 });

    expect(page.items.map((p) => p.id)).toEqual(["e", "d", "c", "b", "a"]);
    expect(page.nextCursor).toBeNull();
    // Chaque élément respecte le contrat public (createdAt en chaîne ISO).
    for (const item of page.items) {
      expect(productSchema.parse(item)).toEqual(item);
    }
  });

  it("borne la page à `limit` et renvoie un curseur quand il reste des éléments", async () => {
    const repo = makeInMemoryRepository(fixtureRecords());
    const page = await listProducts(repo, { limit: 2 });

    expect(page.items.map((p) => p.id)).toEqual(["e", "d"]);
    expect(page.nextCursor).not.toBeNull();
  });

  it("parcourt toutes les pages sans doublon ni trou via le curseur", async () => {
    const repo = makeInMemoryRepository(fixtureRecords());

    const seen: string[] = [];
    let cursor: string | undefined;
    // Garde-fou contre une boucle infinie.
    for (let i = 0; i < 10; i++) {
      const page = await listProducts(repo, { limit: 2, cursor });
      seen.push(...page.items.map((p) => p.id));
      if (page.nextCursor === null) {
        break;
      }
      cursor = page.nextCursor;
    }

    expect(seen).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("renvoie une page vide sans curseur quand le catalogue est vide", async () => {
    const repo = makeInMemoryRepository([]);
    const page = await listProducts(repo, { limit: PRODUCTS_DEFAULT_LIMIT });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
