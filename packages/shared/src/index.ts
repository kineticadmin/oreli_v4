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
