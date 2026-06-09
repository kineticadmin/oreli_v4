import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProductRecord } from "../products/service";
import type { CandidateFilter, CandidateRepository } from "./service";

/**
 * Dépôt de candidats adossé à Prisma (SPEC-001 · T3). Le filtre est appliqué
 * côté SQL : borne de budget `[min, max]`, `inStock = true`, et au moins un
 * `occasionTags` correspondant (`has`). Le tri `(createdAt, id) desc` est
 * déterministe et s'appuie sur l'index `Product_createdAt_id_idx` ; `take`
 * borne le nombre de candidats côté base.
 */
export function createPrismaCandidateRepository(
  prisma: PrismaClient,
): CandidateRepository {
  return {
    async findCandidates(
      filter: CandidateFilter,
      limit: number,
    ): Promise<ProductRecord[]> {
      const where: Prisma.ProductWhereInput = {
        inStock: true,
        priceCents: {
          gte: filter.budget.minCents,
          lte: filter.budget.maxCents,
        },
        occasionTags: { has: filter.occasion },
      };

      return prisma.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
    },
  };
}
