import type {
  ProductRecord,
  ProductRepository,
} from "../src/products/service";
import type {
  CandidateFilter,
  CandidateRepository,
} from "../src/prefilter/service";

/** Construit un enregistrement produit de test avec des valeurs par défaut. */
export function makeRecord(
  overrides: Partial<ProductRecord> & Pick<ProductRecord, "id" | "createdAt">,
): ProductRecord {
  return {
    vendorId: "vendor-1",
    title: `Produit ${overrides.id}`,
    description: "Description de test.",
    priceCents: 1500,
    currency: "EUR",
    imageUrl: `https://picsum.photos/seed/${overrides.id}/600/600`,
    tags: ["test"],
    occasionTags: ["anniversaire"],
    inStock: true,
    ...overrides,
  };
}

/**
 * Dépôt en mémoire reproduisant la sémantique « keyset » du dépôt Prisma :
 * tri `(createdAt desc, id desc)` et curseur exclusif. Permet de tester le
 * service de pagination sans base de données.
 */
export function makeInMemoryRepository(
  records: ProductRecord[],
): ProductRepository {
  const sorted = [...records].sort(compareDesc);

  return {
    async findPage({ limit, after }) {
      const pool =
        after === null
          ? sorted
          : sorted.filter((record) => {
              const recordTime = record.createdAt.getTime();
              const afterTime = after.createdAt.getTime();
              if (recordTime < afterTime) {
                return true;
              }
              return recordTime === afterTime && record.id < after.id;
            });
      return pool.slice(0, limit);
    },
  };
}

/**
 * Dépôt de candidats en mémoire reproduisant la sémantique SQL du dépôt Prisma :
 * borne de budget inclusive, `inStock = true`, au moins un `occasionTags`
 * correspondant, tri `(createdAt desc, id desc)` puis troncature à `limit`.
 * Permet de tester le pré-filtre sans base de données.
 */
export function makeInMemoryCandidateRepository(
  records: ProductRecord[],
): CandidateRepository {
  const sorted = [...records].sort(compareDesc);

  return {
    async findCandidates(filter: CandidateFilter, limit: number) {
      return sorted
        .filter(
          (record) =>
            record.inStock &&
            record.priceCents >= filter.budget.minCents &&
            record.priceCents <= filter.budget.maxCents &&
            record.occasionTags.includes(filter.occasion),
        )
        .slice(0, limit);
    },
  };
}

function compareDesc(a: ProductRecord, b: ProductRecord): number {
  const byTime = b.createdAt.getTime() - a.createdAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? 1 : -1;
}
