import {
  type CreateOrderRequest,
  createOrderRequestSchema,
  type CreateOrderResponse,
  type Order,
  type OrderStatus,
  type ShippingRecipient,
} from "@oreli/shared";

/**
 * Service de checkout (SPEC-001 · T6).
 *
 * Enchaînement : validation Zod de l'entrée, lecture *autoritaire* du produit
 * (le client n'envoie jamais de montant), création d'un `PaymentIntent` Stripe
 * (mode test), puis persistance de l'`Order` avec le statut dérivé du paiement.
 * Le montant stocké provient toujours du catalogue, ce qui garantit le critère
 * d'acceptation « la commande est créée avec le bon montant ».
 *
 * Toutes les frontières externes (Stripe, base) sont des ports injectables :
 * les tests fournissent des implémentations déterministes, sans réseau ni base.
 */

/** Produit minimal nécessaire au checkout (prix et disponibilité font foi). */
export interface CheckoutProduct {
  id: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
}

/** Port de lecture d'un produit par identifiant. */
export interface ProductLookup {
  findById(id: string): Promise<CheckoutProduct | null>;
}

/** Enregistrement de commande à créer (sans `id` ni `createdAt`, posés en base). */
export interface NewOrder {
  giftSessionId: string;
  productId: string;
  amountCents: number;
  currency: string;
  stripePaymentIntentId: string;
  status: OrderStatus;
  recipient: ShippingRecipient;
  deliveryDate: Date;
}

/** Enregistrement de commande persisté (`createdAt`/`deliveryDate` en `Date`). */
export interface OrderRecord extends NewOrder {
  id: string;
  createdAt: Date;
}

/** Port de persistance des commandes. */
export interface OrderRepository {
  create(order: NewOrder): Promise<OrderRecord>;
}

/** Données nécessaires à la création d'un `PaymentIntent` (montant autoritaire). */
export interface PaymentIntentInput {
  amountCents: number;
  currency: string;
  metadata: Record<string, string>;
}

/** Résultat d'un `PaymentIntent` Stripe, réduit aux champs utiles. */
export interface PaymentIntentResult {
  id: string;
  clientSecret: string | null;
  /** Statut Stripe (`succeeded`, `requires_payment_method`, …). */
  status: string;
}

/**
 * Port de la passerelle de paiement. L'adaptateur de production (Stripe) est la
 * frontière réseau, non couverte par les tests unitaires ; la logique métier
 * testée vit ici.
 */
export interface PaymentGateway {
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
}

/** Dépendances injectables du service de checkout. */
export interface CheckoutDeps {
  products: ProductLookup;
  orders: OrderRepository;
  payments: PaymentGateway;
}

/** Levée lorsque le corps de la requête de checkout est invalide. */
export class InvalidCheckoutError extends Error {
  constructor(
    message = "Requête de checkout invalide",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "InvalidCheckoutError";
  }
}

/** Levée lorsque le produit demandé n'existe pas. */
export class ProductNotFoundError extends Error {
  constructor(message = "Produit introuvable") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

/** Levée lorsque le produit demandé n'est plus en stock. */
export class ProductOutOfStockError extends Error {
  constructor(message = "Produit indisponible") {
    super(message);
    this.name = "ProductOutOfStockError";
  }
}

/** Levée lorsque la passerelle de paiement échoue. */
export class PaymentGatewayError extends Error {
  constructor(message = "Paiement indisponible", cause?: unknown) {
    super(message, { cause });
    this.name = "PaymentGatewayError";
  }
}

/** Projette un enregistrement interne vers la forme publique `Order`. */
export function toOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    giftSessionId: record.giftSessionId,
    productId: record.productId,
    amountCents: record.amountCents,
    currency: record.currency,
    stripePaymentIntentId: record.stripePaymentIntentId,
    status: record.status,
    recipient: record.recipient,
    deliveryDate: record.deliveryDate.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

/** Dérive le statut de commande du statut du `PaymentIntent` Stripe. */
function orderStatusFromIntent(intentStatus: string): OrderStatus {
  if (intentStatus === "succeeded") {
    return "paid";
  }
  if (
    intentStatus === "canceled" ||
    intentStatus === "requires_payment_method"
  ) {
    return "failed";
  }
  return "pending";
}

/**
 * Crée une commande et son paiement de test. Valide l'entrée (lève
 * `InvalidCheckoutError`), vérifie l'existence et la disponibilité du produit
 * (lève `ProductNotFoundError` / `ProductOutOfStockError`), crée le
 * `PaymentIntent` (lève `PaymentGatewayError` en cas d'échec réseau Stripe),
 * puis persiste l'`Order`. Le montant et la devise proviennent du produit.
 */
export async function createCheckout(
  deps: CheckoutDeps,
  input: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const parsed = createOrderRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidCheckoutError(undefined, parsed.error.flatten());
  }
  const data = parsed.data;

  const product = await deps.products.findById(data.productId);
  if (product === null) {
    throw new ProductNotFoundError();
  }
  if (!product.inStock) {
    throw new ProductOutOfStockError();
  }

  const amountCents = product.priceCents;
  const currency = product.currency;

  let intent: PaymentIntentResult;
  try {
    intent = await deps.payments.createPaymentIntent({
      amountCents,
      currency,
      metadata: {
        giftSessionId: data.giftSessionId,
        productId: product.id,
      },
    });
  } catch (err) {
    throw new PaymentGatewayError(undefined, err);
  }

  const order = await deps.orders.create({
    giftSessionId: data.giftSessionId,
    productId: product.id,
    amountCents,
    currency,
    stripePaymentIntentId: intent.id,
    status: orderStatusFromIntent(intent.status),
    recipient: data.recipient,
    deliveryDate: new Date(data.deliveryDate),
  });

  return { order: toOrder(order), clientSecret: intent.clientSecret };
}
