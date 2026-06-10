/**
 * Client de mesure PostHog côté application (SPEC-001 · T7).
 *
 * Émet les événements clés du parcours acheteur vers l'API de capture HTTP de
 * PostHog (`POST {host}/capture/`). On n'ajoute aucune dépendance : le client
 * s'appuie sur `fetch`, injectable comme pour `gift/api.ts` et `checkout/api.ts`,
 * ce qui le rend testable sous Vitest sans réseau réel.
 *
 * Deux garde-fous :
 * - Sans clé publique configurée (`EXPO_PUBLIC_POSTHOG_KEY`), le client est un
 *   no-op silencieux : la mesure est facultative et n'empêche jamais le parcours.
 * - La capture n'échoue jamais bruyamment : toute erreur réseau est avalée et
 *   renvoyée comme `{ sent: false }`. La mesure ne doit pas dégrader l'UX.
 */
import type { AnalyticsEvent } from "./events";

/** Hôte PostHog par défaut (région UE, cohérent avec un projet européen). */
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/** Signature de `fetch` réduite aux besoins du client (injectable en test). */
export type AnalyticsFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number }>;

/** Configuration résolue du client de mesure. */
export interface AnalyticsConfig {
  /** Clé publique de projet PostHog. Absente ⇒ client no-op. */
  apiKey?: string;
  /** Hôte de l'instance PostHog (repli sur la région UE). */
  host?: string;
  /** Implémentation de `fetch` (injectable en test). */
  fetchImpl?: AnalyticsFetch;
}

/** Résultat d'une capture : `sent` indique si l'événement a bien été émis. */
export interface CaptureResult {
  sent: boolean;
}

/** Client de mesure : une seule opération, `capture`, qui n'échoue jamais. */
export interface Analytics {
  capture: (event: AnalyticsEvent) => Promise<CaptureResult>;
}

const defaultFetch: AnalyticsFetch = (input, init) => fetch(input, init);

/**
 * Résout la configuration de mesure depuis l'environnement public d'Expo. La clé
 * doit être préfixée `EXPO_PUBLIC_` pour être exposée à la cible web.
 */
export function resolveAnalyticsConfig(): AnalyticsConfig {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
  return {
    apiKey: apiKey !== undefined && apiKey.length > 0 ? apiKey : undefined,
    host: host !== undefined && host.length > 0 ? host : undefined,
  };
}

/**
 * Construit un client de mesure. Sans `apiKey`, renvoie un client no-op dont la
 * capture renvoie toujours `{ sent: false }` sans contacter le réseau.
 */
export function createAnalytics(config: AnalyticsConfig = {}): Analytics {
  const apiKey = config.apiKey;
  if (apiKey === undefined || apiKey.length === 0) {
    return { capture: async () => ({ sent: false }) };
  }

  const host = (config.host ?? DEFAULT_POSTHOG_HOST).replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? defaultFetch;
  const url = `${host}/capture/`;

  return {
    capture: async (event: AnalyticsEvent): Promise<CaptureResult> => {
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            event: event.name,
            distinct_id: event.distinctId,
            properties: event.properties,
          }),
        });
        return { sent: response.ok };
      } catch {
        // La mesure est best-effort : on n'interrompt jamais le parcours.
        return { sent: false };
      }
    },
  };
}
