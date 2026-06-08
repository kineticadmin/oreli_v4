import {
  API_PREFIX,
  type HealthResponse,
  makeApiError,
} from "@oreli/shared";
import { Hono } from "hono";
import { logger } from "./logger";

export const SERVICE_NAME = "oreli-api";
export const SERVICE_VERSION = process.env.APP_VERSION ?? "0.0.0";

/**
 * Construit l'application Hono. Tous les endpoints sont montés sous
 * `/api/v1/`. Les erreurs sont renvoyées au format `ApiError`.
 */
export function createApp(): Hono {
  const app = new Hono();

  const v1 = new Hono();

  v1.get("/health", (c) => {
    const body: HealthResponse = {
      status: "ok",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    };
    return c.json(body);
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
