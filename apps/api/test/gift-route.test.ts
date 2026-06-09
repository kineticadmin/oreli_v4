import { API_PREFIX, giftConverseResponseSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import {
  makeInMemoryCandidateRepository,
  makeRecord,
  makeStubGiftModel,
} from "./helpers";

const DATE = new Date("2026-06-01T00:00:00.000Z");

function appWith(raw: unknown) {
  const candidateRepository = makeInMemoryCandidateRepository([
    makeRecord({ id: "a", priceCents: 2000, createdAt: DATE }),
    makeRecord({ id: "b", priceCents: 3000, createdAt: DATE }),
  ]);
  return createApp({
    candidateRepository,
    giftModel: makeStubGiftModel(raw),
  });
}

function validBody() {
  return {
    guestToken: "guest-1",
    budgetMinCents: 1000,
    budgetMaxCents: 5000,
    occasion: "anniversaire",
    eventDate: "2026-12-24T00:00:00.000Z",
    mode: "selection",
    recipient: { tastes: ["thé"] },
    messages: [{ role: "user", content: "Une idée cadeau ?" }],
  };
}

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request(`${API_PREFIX}/gift/converse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/gift/converse", () => {
  it("renvoie une réponse conforme au schéma avec short list", async () => {
    const app = appWith({
      reply: "Voici deux idées.",
      readyToSuggest: true,
      mode: "selection",
      productIds: ["a", "b"],
    });

    const res = await post(app, validBody());

    expect(res.status).toBe(200);
    const parsed = giftConverseResponseSchema.parse(await res.json());
    expect(parsed.shortlist?.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("rejette un corps invalide avec une ApiError 400", async () => {
    const app = appWith({ reply: "x", readyToSuggest: false, mode: "selection" });

    const res = await post(app, { ...validBody(), budgetMaxCents: -1 });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });

  it("renvoie une ApiError 502 quand le modèle viole le contrat", async () => {
    const app = appWith({ reply: "x", readyToSuggest: "oui" });

    const res = await post(app, validBody());

    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("model_error");
  });

  it("rejette un JSON malformé avec une ApiError 400", async () => {
    const app = appWith({ reply: "x", readyToSuggest: false, mode: "selection" });

    const res = await app.request(`${API_PREFIX}/gift/converse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ pas du json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });
});
