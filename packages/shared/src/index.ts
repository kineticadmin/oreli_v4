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

/* -------------------------------------------------------------------------- */
/* Dialogue cadeau · Oreli (SPEC-001 · T4)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Modes de proposition. Deux modes (SPEC-001) : `selection` (sélection
 * accompagnée, 3 à 5 produits) et `surprise` (un unique produit, sans révéler
 * de liste). Les variantes « totale / encadrée » de la surprise s'expriment par
 * le profil destinataire et le budget, non par un mode distinct.
 */
export const giftModeSchema = z.enum(["selection", "surprise"]);

export type GiftMode = z.infer<typeof giftModeSchema>;

/** Tailles de short list (mode `selection`) garanties à l'utilisateur. */
export const SHORTLIST_MIN = 3;
export const SHORTLIST_MAX = 5;

/**
 * Attributs non identifiants de la personne destinataire transmis au modèle.
 * `.strict()` rejette tout champ supplémentaire (nom, e-mail, adresse…), ce qui
 * garantit côté schéma qu'aucune donnée identifiante n'atteint Gemini
 * (SPEC-001 · contrainte de confidentialité).
 */
export const recipientProfileSchema = z
  .object({
    /** Type de relation (ex. « ami proche », « parent »). */
    relationship: z.string().min(1).max(120).optional(),
    /** Goûts et centres d'intérêt non identifiants. */
    tastes: z.array(z.string().min(1).max(120)).max(20).default([]),
    /** Ton souhaité pour le cadeau (ex. « tendre », « ludique »). */
    tone: z.string().min(1).max(120).optional(),
  })
  .strict();

export type RecipientProfile = z.infer<typeof recipientProfileSchema>;

/** Rôle d'un tour de conversation : l'utilisateur ou Oreli. */
export const conversationRoleSchema = z.enum(["user", "oreli"]);

export type ConversationRole = z.infer<typeof conversationRoleSchema>;

/** Un tour de conversation entre l'utilisateur et Oreli. */
export const conversationMessageSchema = z
  .object({
    role: conversationRoleSchema,
    content: z.string().min(1).max(2000),
  })
  .strict();

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

/**
 * État de session transmis en entrée de `POST /api/v1/gift/converse`. Le client
 * détient l'état (la conversation est sans état côté serveur dans cette tranche)
 * et le renvoie à chaque tour. `eventDate` est une chaîne ISO 8601.
 */
export const giftSessionStateSchema = z
  .object({
    guestToken: z.string().min(1),
    budgetMinCents: z.number().int().nonnegative(),
    budgetMaxCents: z.number().int().positive(),
    occasion: z.string().min(1),
    eventDate: z.string().datetime(),
    mode: giftModeSchema,
    recipient: recipientProfileSchema,
    messages: z.array(conversationMessageSchema).min(1).max(50),
  })
  .strict()
  .refine((state) => state.budgetMinCents <= state.budgetMaxCents, {
    message: "budgetMinCents doit être inférieur ou égal à budgetMaxCents",
    path: ["budgetMinCents"],
  });

export type GiftSessionState = z.infer<typeof giftSessionStateSchema>;

/**
 * Sortie brute attendue du modèle produit, parsée en JSON strict (SPEC-001) :
 * `{ reply, readyToSuggest, mode, productIds? }`. `.strict()` rejette tout champ
 * hors contrat.
 */
export const oreliReplySchema = z
  .object({
    reply: z.string().min(1),
    readyToSuggest: z.boolean(),
    mode: giftModeSchema,
    productIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type OreliReply = z.infer<typeof oreliReplySchema>;

/**
 * Réponse de `POST /api/v1/gift/converse`. Quand `readyToSuggest` est vrai, soit
 * `shortlist` (mode `selection`) soit `surprise` (mode `surprise`) est renseigné,
 * jamais les deux ; l'autre vaut `null`.
 */
export const giftConverseResponseSchema = z.object({
  reply: z.string(),
  readyToSuggest: z.boolean(),
  mode: giftModeSchema,
  shortlist: z.array(productSchema).nullable(),
  surprise: productSchema.nullable(),
});

export type GiftConverseResponse = z.infer<typeof giftConverseResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Checkout · Commande (SPEC-001 · T6)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Statut d'une commande. `pending` : `PaymentIntent` créé mais paiement non
 * confirmé ; `paid` : paiement abouti (mode test Stripe) ; `failed` : paiement
 * refusé. Le statut est dérivé du statut du `PaymentIntent`, jamais fourni par
 * le client.
 */
export const orderStatusSchema = z.enum(["pending", "paid", "failed"]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

/**
 * Coordonnées de livraison du destinataire. Contrairement au profil transmis au
 * modèle (`recipientProfileSchema`), ces données *peuvent* être identifiantes
 * (nom, adresse) : elles servent l'expédition et **ne sont jamais envoyées au
 * modèle produit**. `.strict()` borne les champs acceptés. `country` est un code
 * ISO 3166-1 alpha-2 (Belgique par défaut, catalogue bruxellois).
 */
export const shippingRecipientSchema = z
  .object({
    name: z.string().min(1).max(200),
    line1: z.string().min(1).max(200),
    line2: z.string().min(1).max(200).optional(),
    postalCode: z.string().min(1).max(20),
    city: z.string().min(1).max(120),
    country: z
      .string()
      .length(2)
      .regex(/^[A-Za-z]{2}$/, "Code pays ISO 3166-1 alpha-2 attendu")
      .transform((value) => value.toUpperCase())
      .default("BE"),
  })
  .strict();

export type ShippingRecipient = z.infer<typeof shippingRecipientSchema>;

/**
 * Corps de `POST /api/v1/checkout`. Le client n'envoie jamais de montant : le
 * serveur fait autorité sur le prix (lu depuis le produit), ce qui garantit le
 * critère d'acceptation « la commande est créée avec le bon montant ».
 * `giftSessionId` est le jeton de session invité (la `GiftSession` n'est pas
 * persistée dans cette tranche : la conversation reste détenue côté client, T4).
 */
export const createOrderRequestSchema = z
  .object({
    giftSessionId: z.string().min(1),
    productId: z.string().min(1),
    recipient: shippingRecipientSchema,
    deliveryDate: z.string().datetime(),
  })
  .strict();

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

/** Représentation publique d'une commande (dates sérialisées en ISO 8601). */
export const orderSchema = z.object({
  id: z.string(),
  giftSessionId: z.string(),
  productId: z.string(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string(),
  stripePaymentIntentId: z.string(),
  status: orderStatusSchema,
  recipient: shippingRecipientSchema,
  deliveryDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type Order = z.infer<typeof orderSchema>;

/**
 * Réponse de `POST /api/v1/checkout` : la commande créée et le `client_secret`
 * du `PaymentIntent` (utile à une confirmation côté client ; `null` lorsque le
 * paiement de test aboutit déjà côté serveur).
 */
export const createOrderResponseSchema = z.object({
  order: orderSchema,
  clientSecret: z.string().nullable(),
});

export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export {
  buildOreliCatalogueBlock,
  ORELI_PROMPT_VERSION,
  ORELI_SYSTEM_PROMPT,
} from "./prompts/oreli";
