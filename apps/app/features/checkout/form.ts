/**
 * Logique de formulaire de checkout côté application (SPEC-001 · T6).
 *
 * Fonctions pures qui transforment la saisie de l'écran de paiement (coordonnées
 * de livraison, date) en `CreateOrderRequest` validé par le schéma Zod partagé,
 * puis assemblé avec le produit choisi et le jeton de session invité. Isolées des
 * composants `.tsx` pour rester testables sous Vitest (comme `gift/session.ts`).
 *
 * Ces coordonnées *peuvent* être identifiantes (nom, adresse) : elles servent
 * l'expédition et ne transitent jamais par le modèle produit (T4).
 */
import {
  type CreateOrderRequest,
  createOrderRequestSchema,
} from "@oreli/shared";

import { isoFromDateInput } from "../gift/session";

/** Saisie brute de l'écran de paiement (champs texte de l'interface). */
export interface DeliveryForm {
  /** Nom complet du destinataire. */
  name: string;
  /** Ligne d'adresse principale. */
  line1: string;
  /** Complément d'adresse (optionnel). */
  line2: string;
  /** Code postal. */
  postalCode: string;
  /** Ville. */
  city: string;
  /** Date de livraison souhaitée au format AAAA-MM-JJ. */
  deliveryDate: string;
}

/** Valeurs initiales du formulaire de livraison. */
export const INITIAL_DELIVERY_FORM: DeliveryForm = {
  name: "",
  line1: "",
  line2: "",
  postalCode: "",
  city: "",
  deliveryDate: "",
};

/** Résultat d'assemblage : requête validée, ou liste de messages d'erreur. */
export type BuildOrderResult =
  | { ok: true; request: CreateOrderRequest }
  | { ok: false; errors: string[] };

/**
 * Assemble et valide une `CreateOrderRequest` à partir de la saisie de livraison,
 * du jeton de session invité et du produit choisi. Renvoie une liste d'erreurs
 * lisibles lorsqu'un champ est invalide, sans jamais laisser passer une requête
 * malformée (validation finale par le schéma Zod partagé).
 */
export function buildOrderRequest(
  form: DeliveryForm,
  giftSessionId: string,
  productId: string,
): BuildOrderResult {
  const errors: string[] = [];

  const name = form.name.trim();
  if (name.length === 0) {
    errors.push("Indiquez le nom du destinataire.");
  }

  const line1 = form.line1.trim();
  if (line1.length === 0) {
    errors.push("Indiquez l'adresse de livraison.");
  }

  const postalCode = form.postalCode.trim();
  if (postalCode.length === 0) {
    errors.push("Indiquez le code postal.");
  }

  const city = form.city.trim();
  if (city.length === 0) {
    errors.push("Indiquez la ville.");
  }

  const deliveryDate = isoFromDateInput(form.deliveryDate);
  if (deliveryDate === null) {
    errors.push("Date de livraison invalide (format attendu : AAAA-MM-JJ).");
  }

  if (errors.length > 0 || deliveryDate === null) {
    return { ok: false, errors };
  }

  const line2 = form.line2.trim();
  const candidate = {
    giftSessionId,
    productId,
    recipient: {
      name,
      line1,
      postalCode,
      city,
      ...(line2.length > 0 ? { line2 } : {}),
    },
    deliveryDate,
  };

  const parsed = createOrderRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }
  return { ok: true, request: parsed.data };
}

/** Formate un montant en centimes vers une chaîne lisible (« 45,00 € »). */
export function formatAmount(amountCents: number, currency: string): string {
  const value = (amountCents / 100).toFixed(2).replace(".", ",");
  const symbol = currency.toUpperCase() === "EUR" ? "€" : currency.toUpperCase();
  return `${value} ${symbol}`;
}
