import { API_PREFIX, healthResponseSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /api/v1/health", () => {
  it("renvoie un statut ok conforme au schéma", async () => {
    const app = createApp();
    const res = await app.request(`${API_PREFIX}/health`);

    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = healthResponseSchema.parse(body);
    expect(parsed.status).toBe("ok");
    expect(parsed.service).toBe("oreli-api");
  });

  it("renvoie une ApiError 404 sur une route inconnue", async () => {
    const app = createApp();
    const res = await app.request(`${API_PREFIX}/inconnu`);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe("not_found");
  });
});
