import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ProductPageRequest,
  ProductRecord,
  ProductRepository,
} from "./service";

/**
 * Dépôt produits adossé à Prisma. La pagination est un curseur composite
 * « keyset » sur `(createdAt, id)` : le `WHERE` borne strictement après le
 * curseur, sans LIMIT/OFFSET (SYSTEM.md). L'index `Product_createdAt_id_idx`
 * soutient ce tri.
 */
export function createPrismaProductRepository(
  prisma: PrismaClient,
): ProductRepository {
  return {
    async findPage({
      limit,
      after,
    }: ProductPageRequest): Promise<ProductRecord[]> {
      const where: Prisma.ProductWhereInput = after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {};

      return prisma.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
    },
  };
}
