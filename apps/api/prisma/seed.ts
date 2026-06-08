import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { logger } from "../src/logger";
import {
  imageUrlFor,
  parseSeedData,
  type SeedProduct,
} from "../src/products/catalogue-seed";

/**
 * Seed du catalogue (SPEC-001 · T1) : 25 produits curés de cinq artisans
 * bruxellois, lus depuis `seed-data.json`. Idempotent : chaque vendeur et
 * chaque produit est inséré via `upsert`, donc relançable sans doublon.
 */
async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, "seed-data.json"), "utf8");
  const data = parseSeedData(raw);

  const prisma = new PrismaClient();
  try {
    const vendorIdBySlug = new Map<string, string>();
    for (const vendor of data.vendors) {
      const row = await prisma.vendor.upsert({
        where: { slug: vendor.slug },
        update: { name: vendor.name, city: vendor.city },
        create: { name: vendor.name, slug: vendor.slug, city: vendor.city },
      });
      vendorIdBySlug.set(vendor.slug, row.id);
    }

    for (const product of data.products) {
      const vendorId = vendorIdBySlug.get(product.vendorSlug);
      if (vendorId === undefined) {
        throw new Error(
          `Vendeur introuvable pour le produit ${product.id} (${product.vendorSlug})`,
        );
      }
      const fields = toProductFields(product, vendorId);
      await prisma.product.upsert({
        where: { id: product.id },
        update: fields,
        create: { id: product.id, ...fields },
      });
    }

    logger.info("seed_done", {
      vendors: data.vendors.length,
      products: data.products.length,
    });
  } finally {
    await prisma.$disconnect();
  }
}

function toProductFields(product: SeedProduct, vendorId: string) {
  return {
    vendorId,
    title: product.title,
    description: product.description,
    priceCents: product.priceCents,
    imageUrl: imageUrlFor(product.id),
    tags: product.tags,
    occasionTags: product.occasionTags,
    inStock: product.inStock,
  };
}

main().catch((error: unknown) => {
  logger.error("seed_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
