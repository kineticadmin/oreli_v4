/**
 * Client de l'endpoint de dialogue cadeau (SPEC-001 · T5).
 *
 * Adapte `POST /api/v1/gift/converse` côté application : sérialise l'état de
 * session, valide la réponse avec le schéma Zod partagé (jamais de confiance
 * aveugle au réseau) et lève une erreur typée et lisible en cas d'échec. Le
 * `fetch` est injectable pour rester testable sous Vitest sans serveur réel.
 */
import {
  API_PREFIX,
  type GiftConverseResponse,
  giftConverseResponseSchema,
  type GiftSessionState,
} from "@oreli/shared";

/** Erreur de dialogue côté client, porteuse d'un code stable et d'un message. */
export class GiftApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GiftApiError";
  }
}

/** Réponse HTTP minimale dont dépend le client (sous-ensemble de `Response`). */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** Signature de `fetch` réduite aux besoins du client (injectable en test). */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponseLike>;

/** Options du client : URL de base et implémentation de `fetch` injectables. */
export interface ConverseOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/**
 * Résout l'URL de base de l'API depuis l'environnement public d'Expo
 * (`EXPO_PUBLIC_API_URL`), avec repli sur le serveur local de développement.
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return fromEnv !== undefined && fromEnv.length > 0
    ? fromEnv
    : "http://localhost:3000";
}

/**
 * Fait avancer le dialogue d'un tour côté client : envoie l'état de session à
 * l'API et renvoie la réponse validée (`reply`, `readyToSuggest`, plus la short
 * list ou la surprise). Lève `GiftApiError` en cas d'échec réseau, de statut
 * non-2xx ou de réponse illisible.
 */
export async function converseRequest(
  state: GiftSessionState,
  options: ConverseOptions = {},
): Promise<GiftConverseResponse> {
  const baseUrl = options.baseUrl ?? resolveApiBaseUrl();
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const url = `${baseUrl.replace(/\/+$/, "")}${API_PREFIX}/gift/converse`;

  let response: FetchResponseLike;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    throw new GiftApiError("network_error", "Connexion à Oreli impossible.");
  }

  if (!response.ok) {
    throw new GiftApiError(
      "http_error",
      `Oreli est indisponible pour le moment (erreur ${response.status}).`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GiftApiError("invalid_response", "Réponse d'Oreli illisible.");
  }

  const parsed = giftConverseResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GiftApiError("invalid_response", "Réponse d'Oreli illisible.");
  }
  return parsed.data;
}
