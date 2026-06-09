import type { Product } from "@oreli/shared";
import { z } from "zod";
import type { ProductRecord } from "../products/service";
import { toProduct } from "../products/service";

/**
 * Pré-filtre du catalogue (SPEC-001 · T3).
 *
 * Avant tout appel au modèle produit (Gemini Flash, T4), on borne le catalogue
 * par une requête SQL déterministe : budget `[min, max]`, `inStock = true`, et
 * au moins un `occasionTags` correspondant. Au plus `CANDIDATES_MAX` candidats
 * sont transmis au modèle, pour borner le coût (SPEC-001 · contraintes).
 */

/** Nombre maximum de candidats transmis au modèle produit. */
export const CANDIDATES_MAX = 40;

/**
 * Critères du pré-filtre. `date` (date de l'occasion) fait partie du contexte
 * de la demande mais ne contraint pas la requête catalogue : le modèle de
 * données n'a pas de fenêtre de disponibilité par produit. Elle est validée
 * ici et restera disponible pour le dialogue d'Oreli (T4).
 */
export const candidateFilterSchema = z
  .object({
    budget: z.object({
      minCents: z.number().int().nonnegative(),
      maxCents: z.number().int().positive(),
    }),
    occasion: z.string().min(1),
    date: z.date(),
  })
  .refine((filter) => filter.budget.minCents <= filter.budget.maxCents, {
    message: "budget.minCents doit être inférieur ou égal à budget.maxCents",
    path: ["budget", "minCents"],
  });

export type CandidateFilter = z.infer<typeof candidateFilterSchema>;

/** Levée lorsqu'un critère de pré-filtre est invalide. */
export class InvalidCandidateFilterError extends Error {
  constructor(
    message = "Critères de pré-filtre invalides",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "InvalidCandidateFilterError";
  }
}

/**
 * Accès aux produits candidats. L'implémentation de production (Prisma) applique
 * le filtre côté SQL ; cette abstraction rend le service testable sans base de
 * données, comme le dépôt de pagination du catalogue.
 */
export interface CandidateRepository {
  findCandidates(
    filter: CandidateFilter,
    limit: number,
  ): Promise<ProductRecord[]>;
}

/**
 * Renvoie les produits candidats pour une demande de cadeau, bornés à
 * `CANDIDATES_MAX`. Valide les critères (lève `InvalidCandidateFilterError`),
 * délègue le filtrage au dépôt, puis garantit la borne quelle que soit
 * l'implémentation du dépôt avant de projeter vers la forme publique.
 */
export async function getCandidates(
  repository: CandidateRepository,
  rawFilter: CandidateFilter,
): Promise<Product[]> {
  const parsed = candidateFilterSchema.safeParse(rawFilter);
  if (!parsed.success) {
    throw new InvalidCandidateFilterError(undefined, parsed.error.flatten());
  }

  const records = await repository.findCandidates(parsed.data, CANDIDATES_MAX);
  return records.slice(0, CANDIDATES_MAX).map(toProduct);
}
