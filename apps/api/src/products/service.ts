import type {
  ListProductsQuery,
  Product,
  ProductsPage,
} from "@oreli/shared";
import {
  decodeCursor,
  encodeCursor,
  type ProductCursor,
} from "./cursor";

/**
 * Enregistrement produit tel qu'il est stocké : `createdAt` est une `Date`
 * native, non encore sérialisée. La forme publique (`Product`) en dérive.
 */
export interface ProductRecord {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string;
  tags: string[];
  occasionTags: string[];
  inStock: boolean;
  createdAt: Date;
}

export interface ProductPageRequest {
  /** Nombre maximum d'enregistrements à renvoyer. */
  limit: number;
  /** Curseur exclusif : ne renvoyer que ce qui le suit, ou `null` au départ. */
  after: ProductCursor | null;
}

/**
 * Accès aux produits, ordonnés par `(createdAt desc, id desc)`. L'implémentation
 * de production (Prisma) applique un curseur composite « keyset », jamais
 * LIMIT/OFFSET. Cette abstraction rend le service testable sans base de données.
 */
export interface ProductRepository {
  findPage(request: ProductPageRequest): Promise<ProductRecord[]>;
}

/**
 * Projette un enregistrement interne vers la forme publique `Product`
 * (`createdAt` sérialisé en chaîne ISO 8601). Exporté pour être réutilisé par
 * d'autres services qui exposent des produits (ex. le pré-filtre, T3).
 */
export function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    vendorId: record.vendorId,
    title: record.title,
    description: record.description,
    priceCents: record.priceCents,
    currency: record.currency,
    imageUrl: record.imageUrl,
    tags: record.tags,
    occasionTags: record.occasionTags,
    inStock: record.inStock,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Renvoie une page de produits paginée par curseur. Demande `limit + 1`
 * enregistrements au dépôt pour savoir s'il existe une page suivante sans
 * second appel, puis tronque à `limit`.
 *
 * Lève `InvalidCursorError` si `query.cursor` est fourni mais illisible.
 */
export async function listProducts(
  repository: ProductRepository,
  query: ListProductsQuery,
): Promise<ProductsPage> {
  const after = query.cursor ? decodeCursor(query.cursor) : null;
  const records = await repository.findPage({ limit: query.limit + 1, after });

  const hasMore = records.length > query.limit;
  const pageRecords = hasMore ? records.slice(0, query.limit) : records;
  const lastRecord = pageRecords.at(-1);

  const nextCursor =
    hasMore && lastRecord !== undefined
      ? encodeCursor({ createdAt: lastRecord.createdAt, id: lastRecord.id })
      : null;

  return { items: pageRecords.map(toProduct), nextCursor };
}
