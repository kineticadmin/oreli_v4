import {
  API_PREFIX,
  type HealthResponse,
  listProductsQuerySchema,
  makeApiError,
} from "@oreli/shared";
import { Hono } from "hono";
import { getPrismaClient } from "./db";
import { logger } from "./logger";
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
