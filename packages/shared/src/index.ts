/**
 * Types et schémas Zod partagés entre l'API et l'application.
 *
 * Règle absolue (SYSTEM.md) : toutes les entrées API sont validées par Zod ;
 * les erreurs sont renvoyées au format `ApiError { code, message, details }`.
 *
 * T0 ne pose que le socle (ApiError, santé). Le modèle de données métier
 * (Vendor, Product, GiftSession, Order) relève des tâches suivantes.
 */
import { z } from "zod";

export const API_PREFIX = "/api/v1";

/** Format d'erreur unique de l'API. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Construit un objet d'erreur conforme au contrat de l'API. */
export function makeApiError(
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  return details === undefined
    ? { code, message }
    : { code, message, details };
}

/** Réponse de l'endpoint de santé `GET /api/v1/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Catalogue produits (SPEC-001 · T1)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Représentation publique d'un produit du catalogue, telle que renvoyée par
 * l'API. `createdAt` est sérialisé en chaîne ISO 8601 (JSON n'a pas de date).
 */
export const productSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  title: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string(),
  imageUrl: z.string().url(),
  tags: z.array(z.string()),
  occasionTags: z.array(z.string()),
  inStock: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Product = z.infer<typeof productSchema>;

/** Borne par défaut et borne maximale du nombre d'éléments par page. */
export const PRODUCTS_DEFAULT_LIMIT = 20;
export const PRODUCTS_MAX_LIMIT = 50;

/**
 * Paramètres de requête de `GET /api/v1/products`. Pagination par curseur
 * (SYSTEM.md) : `cursor` est un jeton opaque, `limit` est borné.
 */
export const listProductsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRODUCTS_MAX_LIMIT)
    .default(PRODUCTS_DEFAULT_LIMIT),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

/** Page de résultats paginée par curseur. */
export const productsPageSchema = z.object({
  items: z.array(productSchema),
  nextCursor: z.string().nullable(),
});

export type ProductsPage = z.infer<typeof productsPageSchema>;
