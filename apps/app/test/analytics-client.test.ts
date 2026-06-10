import { describe, expect, it } from "vitest";

import {
  type AnalyticsFetch,
  createAnalytics,
  DEFAULT_POSTHOG_HOST,
  resolveAnalyticsConfig,
} from "../features/analytics/client";
import type { AnalyticsEvent } from "../features/analytics/events";

const EVENT: AnalyticsEvent = {
  name: "gift_session_started",
  distinctId: "guest-1",
  properties: { mode: "selection", budgetMinCents: 2000 },
};

/** Construit un `fetch` simulé qui capture l'appel et renvoie la réponse fournie. */
function stubFetch(
  response: Partial<{ ok: boolean; status: number }>,
  capture?: { url?: string; body?: string },
): AnalyticsFetch {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.body = init.body;
    }
    return { ok: response.ok ?? true, status: response.status ?? 200 };
  };
}

describe("resolveAnalyticsConfig", () => {
  it("renvoie une clé absente en l'absence d'environnement", () => {
    const previous = process.env.EXPO_PUBLIC_POSTHOG_KEY;
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    expect(resolveAnalyticsConfig().apiKey).toBeUndefined();
    if (previous !== undefined) {
      process.env.EXPO_PUBLIC_POSTHOG_KEY = previous;
    }
  });
});

describe("createAnalytics", () => {
  it("est un no-op silencieux sans clé configurée", async () => {
    let called = false;
    const fetchImpl: AnalyticsFetch = async () => {
      called = true;
      return { ok: true, status: 200 };
    };
    const analytics = createAnalytics({ fetchImpl });
    const result = await analytics.capture(EVENT);
    expect(result).toEqual({ sent: false });
    expect(called).toBe(false);
  });

  it("poste l'événement à l'API de capture PostHog", async () => {
    const capture: { url?: string; body?: string } = {};
    const analytics = createAnalytics({
      apiKey: "phc_test",
      host: "https://eu.posthog.test/",
      fetchImpl: stubFetch({}, capture),
    });

    const result = await analytics.capture(EVENT);
    expect(result).toEqual({ sent: true });
    expect(capture.url).toBe("https://eu.posthog.test/capture/");

    const body = JSON.parse(capture.body ?? "{}");
    expect(body.api_key).toBe("phc_test");
    expect(body.event).toBe("gift_session_started");
    expect(body.distinct_id).toBe("guest-1");
    expect(body.properties).toEqual({ mode: "selection", budgetMinCents: 2000 });
  });

  it("se rabat sur l'hôte UE par défaut", async () => {
    const capture: { url?: string; body?: string } = {};
    const analytics = createAnalytics({
      apiKey: "phc_test",
      fetchImpl: stubFetch({}, capture),
    });
    await analytics.capture(EVENT);
    expect(capture.url).toBe(`${DEFAULT_POSTHOG_HOST}/capture/`);
  });

  it("renvoie sent=false sur une réponse non-2xx, sans lever", async () => {
    const analytics = createAnalytics({
      apiKey: "phc_test",
      fetchImpl: stubFetch({ ok: false, status: 500 }),
    });
    await expect(analytics.capture(EVENT)).resolves.toEqual({ sent: false });
  });

  it("avale les erreurs réseau et renvoie sent=false", async () => {
    const failing: AnalyticsFetch = async () => {
      throw new Error("offline");
    };
    const analytics = createAnalytics({ apiKey: "phc_test", fetchImpl: failing });
    await expect(analytics.capture(EVENT)).resolves.toEqual({ sent: false });
  });
});
