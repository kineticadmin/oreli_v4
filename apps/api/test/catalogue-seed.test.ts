import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  imageUrlFor,
  parseSeedData,
} from "../src/products/catalogue-seed";

const here = dirname(fileURLToPath(import.meta.url));
const rawSeed = readFileSync(
  join(here, "..", "prisma", "seed-data.json"),
  "utf8",
);

describe("parseSeedData (catalogue curé)", () => {
  it("valide le catalogue semé : 5 artisans, 25 produits", () => {
    const data = parseSeedData(rawSeed);
    expect(data.vendors).toHaveLength(5);
    expect(data.products).toHaveLength(25);
  });

  it("ne référence que des artisans existants", () => {
    const data = parseSeedData(rawSeed);
    const slugs = new Set(data.vendors.map((v) => v.slug));
    for (const product of data.products) {
      expect(slugs.has(product.vendorSlug)).toBe(true);
    }
  });

  it("rejette un produit qui pointe vers un artisan inconnu", () => {
    const broken = JSON.stringify({
      vendors: [{ slug: "a", name: "A", city: "Bruxelles" }],
      products: [
        {
          id: "x",
          vendorSlug: "inconnu",
          title: "X",
          description: "X",
          priceCents: 100,
          tags: [],
          occasionTags: ["noel"],
          inStock: true,
        },
      ],
    });
    expect(() => parseSeedData(broken)).toThrow();
  });
});

describe("imageUrlFor", () => {
  it("dérive une URL d'image stable et valide", () => {
    expect(imageUrlFor("dandoy-speculoos")).toBe(
      "https://picsum.photos/seed/dandoy-speculoos/600/600",
    );
  });
});
