/**
 * Taxonomie des événements clés du parcours acheteur (SPEC-001 · T7).
 *
 * Constructeurs purs qui dérivent un `AnalyticsEvent` typé à partir de l'état de
 * l'écran. Isolés des composants `.tsx` pour rester testables sous Vitest (comme
 * `gift/session.ts` et `checkout/form.ts`).
 *
 * Règle de confidentialité (SYSTEM.md) : la mesure ne porte **aucune donnée
 * identifiante**. On ne transmet jamais le nom ou l'adresse du destinataire, ni
 * le contenu des messages — seulement des attributs de catégorie (mode, budget,
 * occasion, montant). Le `distinct_id` est le jeton invité, déjà non identifiant.
 */
import type { GiftConverseResponse, GiftSessionState, Order } from "@oreli/shared";

/** Noms stables des événements clés suivis dans PostHog. */
export const ANALYTICS_EVENTS = {
  giftSessionStarted: "gift_session_started",
  oreliSuggested: "oreli_suggested",
  giftSelected: "gift_selected",
  orderCompleted: "order_completed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Valeurs de propriété admises : uniquement des scalaires non identifiants. */
export type AnalyticsPropertyValue = string | number | boolean;

/** Propriétés d'un événement (jamais de donnée identifiante, cf. en-tête). */
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

/**
 * Un événement de mesure prêt à émettre : un nom stable, le `distinctId` (jeton
 * invité) et des propriétés de catégorie. `distinctId` est porté à part du corps
 * de propriétés pour correspondre au contrat de capture de PostHog.
 */
export interface AnalyticsEvent {
  name: AnalyticsEventName;
  distinctId: string;
  properties: AnalyticsProperties;
}

/**
 * Démarrage d'une session cadeau : l'utilisateur a validé budget, occasion, mode
 * et profil non identifiant, et lance le dialogue. On mesure les paramètres de
 * catégorie, jamais le contenu du message ni le profil libre.
 */
export function giftSessionStartedEvent(state: GiftSessionState): AnalyticsEvent {
  return {
    name: ANALYTICS_EVENTS.giftSessionStarted,
    distinctId: state.guestToken,
    properties: {
      mode: state.mode,
      occasion: state.occasion,
      budgetMinCents: state.budgetMinCents,
      budgetMaxCents: state.budgetMaxCents,
      tastesCount: state.recipient.tastes.length,
    },
  };
}

/**
 * Oreli a livré une proposition (`readyToSuggest`). On mesure le mode et le
 * nombre d'éléments proposés (1 en surprise, 3 à 5 en sélection), sans détailler
 * les produits.
 */
export function oreliSuggestedEvent(
  guestToken: string,
  response: GiftConverseResponse,
): AnalyticsEvent {
  const suggestionCount =
    response.mode === "surprise"
      ? response.surprise === null
        ? 0
        : 1
      : (response.shortlist?.length ?? 0);
  return {
    name: ANALYTICS_EVENTS.oreliSuggested,
    distinctId: guestToken,
    properties: {
      mode: response.mode,
      suggestionCount,
    },
  };
}

/** L'utilisateur a retenu un cadeau dans la proposition. */
export function giftSelectedEvent(
  guestToken: string,
  product: { id: string; priceCents: number; currency: string },
): AnalyticsEvent {
  return {
    name: ANALYTICS_EVENTS.giftSelected,
    distinctId: guestToken,
    properties: {
      productId: product.id,
      priceCents: product.priceCents,
      currency: product.currency,
    },
  };
}

/**
 * Une commande a abouti (paiement de test Stripe confirmé). On mesure l'identité
 * de la commande, le produit et le montant — **jamais** les coordonnées du
 * destinataire (`order.recipient`), qui sont identifiantes.
 */
export function orderCompletedEvent(
  guestToken: string,
  order: Order,
): AnalyticsEvent {
  return {
    name: ANALYTICS_EVENTS.orderCompleted,
    distinctId: guestToken,
    properties: {
      orderId: order.id,
      productId: order.productId,
      amountCents: order.amountCents,
      currency: order.currency,
      status: order.status,
    },
  };
}
