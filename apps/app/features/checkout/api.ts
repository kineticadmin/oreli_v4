/**
 * Client de l'endpoint de checkout (SPEC-001 · T6).
 *
 * Adapte `POST /api/v1/checkout` côté application : sérialise la demande de
 * commande, valide la réponse avec le schéma Zod partagé (jamais de confiance
 * aveugle au réseau) et lève une erreur typée et lisible en cas d'échec. Le
 * `fetch` est injectable pour rester testable sous Vitest sans serveur réel.
 */
import {
  API_PREFIX,
  type CreateOrderRequest,
  type CreateOrderResponse,
  createOrderResponseSchema,
} from "@oreli/shared";

import {
  type FetchLike,
  type FetchResponseLike,
  resolveApiBaseUrl,
} from "../gift/api";

/** Erreur de checkout côté client, porteuse d'un code stable et d'un message. */
export class CheckoutApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutApiError";
  }
}

/** Options du client : URL de base et implémentation de `fetch` injectables. */
export interface CheckoutOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

/** Traduit un code d'erreur de l'API en message lisible côté client. */
function messageForCode(code: string, status: number): string {
  switch (code) {
    case "product_out_of_stock":
      return "Ce cadeau vient de devenir indisponible.";
    case "product_not_found":
      return "Ce cadeau est introuvable.";
    case "payment_error":
      return "Le paiement n'a pas pu aboutir. Réessayez dans un instant.";
    default:
      return `Le paiement est indisponible pour le moment (erreur ${status}).`;
  }
}

/**
 * Crée la commande et son paiement de test : envoie la demande à l'API et
 * renvoie la réponse validée (`order` + `clientSecret`). Lève `CheckoutApiError`
 * en cas d'échec réseau, de statut non-2xx ou de réponse illisible.
 */
export async function createOrderRequest(
  request: CreateOrderRequest,
  options: CheckoutOptions = {},
): Promise<CreateOrderResponse> {
  const baseUrl = options.baseUrl ?? resolveApiBaseUrl();
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const url = `${baseUrl.replace(/\/+$/, "")}${API_PREFIX}/checkout`;

  let response: FetchResponseLike;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new CheckoutApiError(
      "network_error",
      "Connexion au paiement impossible.",
    );
  }

  if (!response.ok) {
    let code = "http_error";
    try {
      const body = (await response.json()) as { code?: unknown };
      if (typeof body.code === "string") {
        code = body.code;
      }
    } catch {
      // Corps illisible : on conserve le code générique.
    }
    throw new CheckoutApiError(code, messageForCode(code, response.status));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CheckoutApiError("invalid_response", "Réponse de paiement illisible.");
  }

  const parsed = createOrderResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new CheckoutApiError(
      "invalid_response",
      "Réponse de paiement illisible.",
    );
  }
  return parsed.data;
}
