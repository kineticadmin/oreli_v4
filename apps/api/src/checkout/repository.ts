import { orderStatusSchema, shippingRecipientSchema } from "@oreli/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CheckoutProduct,
  NewOrder,
  OrderRecord,
  OrderRepository,
  ProductLookup,
} from "./service";

/**
 * Adaptateurs Prisma des ports de checkout (SPEC-001 · T6). Comme les autres
 * dépôts, ils forment la frontière base de données : la logique testée vit dans
 * `service.ts`, exercée via des ports en mémoire.
 *
 * Le JSON `recipient` relu depuis la base est revalidé par le schéma Zod partagé
 * (jamais de confiance aveugle au stockage), ce qui maintient le « zéro any ».
 */

/** Dépôt de lecture produit (prix et disponibilité) adossé à Prisma. */
export function createPrismaProductLookup(prisma: PrismaClient): ProductLookup {
  return {
    async findById(id: string): Promise<CheckoutProduct | null> {
      const product = await prisma.product.findUnique({
        where: { id },
        select: { id: true, priceCents: true, currency: true, inStock: true },
      });
      return product;
    },
  };
}

/** Dépôt de persistance des commandes adossé à Prisma. */
export function createPrismaOrderRepository(
  prisma: PrismaClient,
): OrderRepository {
  return {
    async create(order: NewOrder): Promise<OrderRecord> {
      const row = await prisma.order.create({
        data: {
          giftSessionId: order.giftSessionId,
          productId: order.productId,
          amountCents: order.amountCents,
          currency: order.currency,
          stripePaymentIntentId: order.stripePaymentIntentId,
          status: order.status,
          recipient: order.recipient satisfies Prisma.InputJsonValue,
          deliveryDate: order.deliveryDate,
        },
      });

      return {
        id: row.id,
        giftSessionId: row.giftSessionId,
        productId: row.productId,
        amountCents: row.amountCents,
        currency: row.currency,
        stripePaymentIntentId: row.stripePaymentIntentId,
        status: orderStatusSchema.parse(row.status),
        recipient: shippingRecipientSchema.parse(row.recipient),
        deliveryDate: row.deliveryDate,
        createdAt: row.createdAt,
      };
    },
  };
}
