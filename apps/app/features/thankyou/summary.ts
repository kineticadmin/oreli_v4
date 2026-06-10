/**
 * Résumé de commande pour la page de remerciement (SPEC-001 · T7).
 *
 * Fonctions pures qui sérialisent une commande aboutie en paramètres de route
 * (`/merci`) puis les relisent côté page. Isolées des composants `.tsx` pour
 * rester testables sous Vitest (comme `gift/session.ts` et `checkout/form.ts`).
 *
 * Règle de confidentialité (SYSTEM.md) : la page de remerciement et son URL ne
 * portent **aucune donnée identifiante**. On ne transmet que l'identité de la
 * commande et son montant — jamais `order.recipient` (nom, adresse).
 */
import { type Order, type OrderStatus, orderStatusSchema } from "@oreli/shared";

/** Résumé non identifiant d'une commande, affiché sur la page de remerciement. */
export interface ThankYouSummary {
  orderId: string;
  amountCents: number;
  currency: string;
  status: OrderStatus;
  paymentIntentId: string;
}

/** Paramètres de route plats (chaînes), tels qu'attendus par Expo Router. */
export type ThankYouParams = Record<string, string>;

/**
 * Sérialise une commande aboutie en paramètres de route non identifiants. Le nom
 * et l'adresse du destinataire (`order.recipient`) sont volontairement omis : ils
 * n'apparaissent jamais dans l'URL de remerciement.
 */
export function encodeThankYouParams(order: Order): ThankYouParams {
  return {
    orderId: order.id,
    amountCents: String(order.amountCents),
    currency: order.currency,
    status: order.status,
    paymentIntentId: order.stripePaymentIntentId,
  };
}

/** Lit un paramètre de route (Expo Router peut renvoyer une chaîne ou un tableau). */
function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Relit le résumé de commande depuis les paramètres de route. Renvoie `null` si
 * un champ requis manque ou est invalide (ex. accès direct à `/merci` sans
 * commande), ce qui laisse la page afficher un repli neutre.
 */
export function decodeThankYouParams(
  params: Record<string, string | string[] | undefined>,
): ThankYouSummary | null {
  const orderId = readParam(params.orderId);
  const amountRaw = readParam(params.amountCents);
  const currency = readParam(params.currency);
  const statusRaw = readParam(params.status);
  const paymentIntentId = readParam(params.paymentIntentId);

  if (
    orderId === undefined ||
    orderId.length === 0 ||
    amountRaw === undefined ||
    currency === undefined ||
    currency.length === 0 ||
    paymentIntentId === undefined ||
    paymentIntentId.length === 0
  ) {
    return null;
  }

  const amountCents = Number(amountRaw);
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    return null;
  }

  const status = orderStatusSchema.safeParse(statusRaw);
  if (!status.success) {
    return null;
  }

  return {
    orderId,
    amountCents,
    currency,
    status: status.data,
    paymentIntentId,
  };
}
