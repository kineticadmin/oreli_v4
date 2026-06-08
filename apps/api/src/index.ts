import { serve } from "@hono/node-server";
import { createApp, SERVICE_NAME, SERVICE_VERSION } from "./app";
import { logger } from "./logger";

const port = Number(process.env.PORT ?? 3000);

const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  logger.info("api_started", {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    port: info.port,
  });
});
