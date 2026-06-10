import {
  API_PREFIX,
  createOrderRequestSchema,
  giftSessionStateSchema,
  type HealthResponse,
  listProductsQuerySchema,
  makeApiError,
} from "@oreli/shared";
import { Hono } from "hono";
import {
  createPrismaOrderRepository,
  createPrismaProductLookup,
} from "./checkout/repository";
import {
  type CheckoutDeps,
  createCheckout,
  InvalidCheckoutError,
  type OrderRepository,
  type PaymentGateway,
  PaymentGatewayError,
  ProductNotFoundError,
  ProductOutOfStockError,
  type ProductLookup,
} from "./checkout/service";
import { createStripePaymentGateway } from "./checkout/stripe";
import { getPrismaClient } from "./db";
import { createGeminiGiftModel } from "./gift/gemini";
import type { GiftModel } from "./gift/model";
import {
  converse,
  type ConverseDeps,
  GiftModelError,
  InvalidGiftStateError,
} from "./gift/service";
import { logger } from "./logger";
import { createPrismaCandidateRepository } from "./prefilter/repository";
import type { CandidateRepository } from "./prefilter/service";
import { InvalidCursorError } from "./products/cursor";
import { createPrismaProductRepository } from "./products/repository";
import { listProducts, type ProductRepository } from "./products/service";

export const SERVICE_NAME = "oreli-api";
export const SERVICE_VERSION = process.env.APP_VERSION ?? "0.0.0";

/**
 * Dépendances injectables de l'application. Par défaut, le dépôt produits est
 * adossé à Prisma ; les tests injectent une implémentation en mémoire.
 */
export interface AppDependencies {
  productRepository?: ProductRepository;
  candidateRepository?: CandidateRepository;
  giftModel?: GiftModel;
  productLookup?: ProductLookup;
  orderRepository?: OrderRepository;
  paymentGateway?: PaymentGateway;
}

/**
 * Construit l'application Hono. Tous les endpoints sont montés sous
 * `/api/v1/`. Les erreurs sont renvoyées au format `ApiError`.
 */
export function createApp(deps: AppDependencies = {}): Hono {
  const app = new Hono();

  // Dépôt produits résolu paresseusement : Prisma n'est instancié qu'au
  // premier accès réel à la base (jamais pendant les tests).
  let prismaRepository: ProductRepository | null = null;
  const getProductRepository = (): ProductRepository => {
    if (deps.productRepository) {
      return deps.productRepository;
    }
    if (prismaRepository === null) {
      prismaRepository = createPrismaProductRepository(getPrismaClient());
    }
    return prismaRepository;
  };

  // Dépôt de candidats (pré-filtre T3) résolu paresseusement, comme le dépôt
  // produits : Prisma n'est instancié qu'au premier appel réel.
  let prismaCandidateRepository: CandidateRepository | null = null;
  const getCandidateRepository = (): CandidateRepository => {
    if (deps.candidateRepository) {
      return deps.candidateRepository;
    }
    if (prismaCandidateRepository === null) {
      prismaCandidateRepository = createPrismaCandidateRepository(
        getPrismaClient(),
      );
    }
    return prismaCandidateRepository;
  };

  // Modèle produit (Gemini Flash) résolu paresseusement : la clé n'est lue
  // qu'au premier appel réel, jamais pendant les tests (qui injectent un modèle).
  let geminiModel: GiftModel | null = null;
  const getGiftModel = (): GiftModel => {
    if (deps.giftModel) {
      return deps.giftModel;
    }
    if (geminiModel === null) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey === undefined || apiKey.length === 0) {
        throw new Error("GEMINI_API_KEY manquante");
      }
      geminiModel = createGeminiGiftModel(apiKey);
    }
    return geminiModel;
  };

  // Lecture produit et dépôt de commandes (T6), résolus paresseusement comme
  // les autres dépôts Prisma : la base n'est touchée qu'au premier appel réel.
  let prismaProductLookup: ProductLookup | null = null;
  const getProductLookup = (): ProductLookup => {
    if (deps.productLookup) {
      return deps.productLookup;
    }
    if (prismaProductLookup === null) {
      prismaProductLookup = createPrismaProductLookup(getPrismaClient());
    }
    return prismaProductLookup;
  };

  let prismaOrderRepository: OrderRepository | null = null;
  const getOrderRepository = (): OrderRepository => {
    if (deps.orderRepository) {
      return deps.orderRepository;
    }
    if (prismaOrderRepository === null) {
      prismaOrderRepository = createPrismaOrderRepository(getPrismaClient());
    }
    return prismaOrderRepository;
  };

  // Passerelle de paiement (Stripe, mode test) résolue paresseusement : la clé
  // n'est lue qu'au premier appel réel, jamais pendant les tests.
  let stripeGateway: PaymentGateway | null = null;
  const getPaymentGateway = (): PaymentGateway => {
    if (deps.paymentGateway) {
      return deps.paymentGateway;
    }
    if (stripeGateway === null) {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (secretKey === undefined || secretKey.length === 0) {
        throw new Error("STRIPE_SECRET_KEY manquante");
      }
      stripeGateway = createStripePaymentGateway(secretKey);
    }
    return stripeGateway;
  };

  const v1 = new Hono();

  v1.get("/health", (c) => {
    const body: HealthResponse = {
      status: "ok",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    };
    return c.json(body);
  });

  v1.get("/products", async (c) => {
    const parsed = listProductsQuerySchema.safeParse({
      cursor: c.req.query("cursor"),
      limit: c.req.query("limit"),
    });

    if (!parsed.success) {
      return c.json(
        makeApiError(
          "validation_error",
          "Paramètres de requête invalides",
          parsed.error.flatten(),
        ),
        400,
      );
    }

    try {
      const page = await listProducts(getProductRepository(), parsed.data);
      return c.json(page);
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        return c.json(makeApiError("invalid_cursor", err.message), 400);
      }
      throw err;
    }
  });

  v1.post("/gift/converse", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json(
        makeApiError("validation_error", "Corps de requête JSON invalide"),
        400,
      );
    }

    const parsed = giftSessionStateSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json(
        makeApiError(
          "validation_error",
          "État de session invalide",
          parsed.error.flatten(),
        ),
        400,
      );
    }

    const converseDeps: ConverseDeps = {
      candidateRepository: getCandidateRepository(),
      model: getGiftModel(),
    };

    try {
      const result = await converse(converseDeps, parsed.data);
      return c.json(result);
    } catch (err) {
      if (err instanceof InvalidGiftStateError) {
        return c.json(
          makeApiError("validation_error", err.message, err.details),
          400,
        );
      }
      if (err instanceof GiftModelError) {
        logger.error("gift_model_error", { error: err.message });
        return c.json(
          makeApiError("model_error", "Réponse du modèle indisponible"),
          502,
        );
      }
      throw err;
    }
  });

  v1.post("/checkout", async (c) => {
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json(
        makeApiError("validation_error", "Corps de requête JSON invalide"),
        400,
      );
    }

    const parsed = createOrderRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json(
        makeApiError(
          "validation_error",
          "Requête de checkout invalide",
          parsed.error.flatten(),
        ),
        400,
      );
    }

    const checkoutDeps: CheckoutDeps = {
      products: getProductLookup(),
      orders: getOrderRepository(),
      payments: getPaymentGateway(),
    };

    try {
      const result = await createCheckout(checkoutDeps, parsed.data);
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof InvalidCheckoutError) {
        return c.json(
          makeApiError("validation_error", err.message, err.details),
          400,
        );
      }
      if (err instanceof ProductNotFoundError) {
        return c.json(makeApiError("product_not_found", err.message), 404);
      }
      if (err instanceof ProductOutOfStockError) {
        return c.json(makeApiError("product_out_of_stock", err.message), 409);
      }
      if (err instanceof PaymentGatewayError) {
        logger.error("payment_gateway_error", { error: err.message });
        return c.json(
          makeApiError("payment_error", "Paiement indisponible"),
          502,
        );
      }
      throw err;
    }
  });

  app.route(API_PREFIX, v1);

  app.notFound((c) =>
    c.json(makeApiError("not_found", "Ressource introuvable"), 404),
  );

  app.onError((err, c) => {
    logger.error("unhandled_error", { error: err.message });
    return c.json(
      makeApiError("internal_error", "Erreur interne du serveur"),
      500,
    );
  });

  return app;
}
