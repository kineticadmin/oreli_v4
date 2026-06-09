import type { GiftConverseResponse, GiftSessionState } from "@oreli/shared";
import { describe, expect, it } from "vitest";

import {
  converseRequest,
  type FetchLike,
  GiftApiError,
  resolveApiBaseUrl,
} from "../features/gift/api";

const STATE: GiftSessionState = {
  guestToken: "guest-1",
  budgetMinCents: 2000,
  budgetMaxCents: 6000,
  occasion: "anniversaire",
  eventDate: "2026-12-24T00:00:00.000Z",
  mode: "selection",
  recipient: { tastes: ["thé"] },
  messages: [{ role: "user", content: "Un cadeau doux." }],
};

const OK_RESPONSE: GiftConverseResponse = {
  reply: "Quel est son univers ?",
  readyToSuggest: false,
  mode: "selection",
  shortlist: null,
  surprise: null,
};

/** Construit un `fetch` simulé renvoyant la réponse fournie. */
function stubFetch(
  response: Partial<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
  }>,
  capture?: { url?: string; body?: string },
): FetchLike {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.body = init.body;
    }
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: response.json ?? (async () => OK_RESPONSE),
    };
  };
}

describe("resolveApiBaseUrl", () => {
  it("se rabat sur le serveur local en l'absence d'environnement", () => {
    const previous = process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolveApiBaseUrl()).toBe("http://localhost:3000");
    if (previous !== undefined) {
      process.env.EXPO_PUBLIC_API_URL = previous;
    }
  });
});

describe("converseRequest", () => {
  it("poste l'état de session et renvoie la réponse validée", async () => {
    const capture: { url?: string; body?: string } = {};
    const result = await converseRequest(STATE, {
      baseUrl: "http://api.test",
      fetchImpl: stubFetch({}, capture),
    });

    expect(result).toEqual(OK_RESPONSE);
    expect(capture.url).toBe("http://api.test/api/v1/gift/converse");
    expect(JSON.parse(capture.body ?? "{}").guestToken).toBe("guest-1");
  });

  it("normalise une URL de base à barre oblique finale", async () => {
    const capture: { url?: string; body?: string } = {};
    await converseRequest(STATE, {
      baseUrl: "http://api.test/",
      fetchImpl: stubFetch({}, capture),
    });
    expect(capture.url).toBe("http://api.test/api/v1/gift/converse");
  });

  it("lève GiftApiError sur un statut non-2xx", async () => {
    await expect(
      converseRequest(STATE, {
        baseUrl: "http://api.test",
        fetchImpl: stubFetch({ ok: false, status: 502 }),
      }),
    ).rejects.toBeInstanceOf(GiftApiError);
  });

  it("lève GiftApiError quand la réponse ne respecte pas le contrat", async () => {
    await expect(
      converseRequest(STATE, {
        baseUrl: "http://api.test",
        fetchImpl: stubFetch({ json: async () => ({ reply: 42 }) }),
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("lève GiftApiError en cas d'échec réseau", async () => {
    const failing: FetchLike = async () => {
      throw new Error("offline");
    };
    await expect(
      converseRequest(STATE, { baseUrl: "http://api.test", fetchImpl: failing }),
    ).rejects.toMatchObject({ code: "network_error" });
  });
});
