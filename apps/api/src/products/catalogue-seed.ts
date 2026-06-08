import { z } from "zod";

/**
 * Validation des données de catalogue curées (`prisma/seed-data.json`).
 * Centralisée ici pour être à la fois utilisée par le script de seed et
 * couverte par les tests (intégrité du catalogue semé à la main).
 */
export const seedVendorSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "slug en minuscules, chiffres et tirets"),
  name: z.string().min(1),
  city: z.string().min(1),
});

export const seedProductSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id en minuscules, chiffres et tirets"),
  vendorSlug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priceCents: z.number().int().positive(),
  tags: z.array(z.string().min(1)),
  occasionTags: z.array(z.string().min(1)).min(1),
  inStock: z.boolean(),
});

export const seedDataSchema = z
  .object({
    vendors: z.array(seedVendorSchema).min(1),
    products: z.array(seedProductSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const vendorSlugs = new Set(data.vendors.map((vendor) => vendor.slug));
    const seenProductIds = new Set<string>();

    for (const product of data.products) {
      if (!vendorSlugs.has(product.vendorSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `vendorSlug inconnu pour ${product.id}: ${product.vendorSlug}`,
        });
      }
      if (seenProductIds.has(product.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de produit dupliqué: ${product.id}`,
        });
      }
      seenProductIds.add(product.id);
    }
  });

export type SeedData = z.infer<typeof seedDataSchema>;
export type SeedProduct = z.infer<typeof seedProductSchema>;

/** Parse et valide le contenu brut de `seed-data.json`. */
export function parseSeedData(raw: string): SeedData {
  return seedDataSchema.parse(JSON.parse(raw));
}

/**
 * URL d'illustration déterministe d'un produit. Données de prototype : une
 * image de remplacement stable par identifiant (pas de média réel à héberger).
 */
export function imageUrlFor(productId: string): string {
  return `https://picsum.photos/seed/${productId}/600/600`;
}
