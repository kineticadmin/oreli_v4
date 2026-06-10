import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
} from "./service";

/**
 * Adaptateur Stripe du port `PaymentGateway` (SPEC-001 · T6).
 *
 * Comme l'adaptateur Gemini (T4), c'est la frontière réseau : il n'est pas
 * couvert par les tests unitaires (qui injectent une passerelle déterministe).
 * L'API REST de Stripe est appelée via `fetch` (corps `x-www-form-urlencoded`),
 * sans dépendance SDK, pour rester cohérent avec le reste du dépôt.
 *
 * Mode test (SPEC-001) : le `PaymentIntent` est confirmé immédiatement avec le
 * moyen de paiement de test `pm_card_visa`, ce qui fait aboutir le paiement côté
 * serveur sans intégration d'éléments de carte côté client. La clé provient de
 * `STRIPE_SECRET_KEY` (SYSTEM.md : secrets via l'environnement, jamais en dur).
 */

const STRIPE_PAYMENT_INTENTS_URL = "https://api.stripe.com/v1/payment_intents";

interface StripePaymentIntent {
  id: string;
  client_secret: string | null;
  status: string;
}

/** Construit un adaptateur Stripe (mode test) à partir de la clé secrète. */
export function createStripePaymentGateway(secretKey: string): PaymentGateway {
  return {
    async createPaymentIntent(
      input: PaymentIntentInput,
    ): Promise<PaymentIntentResult> {
      const body = new URLSearchParams({
        amount: String(input.amountCents),
        currency: input.currency.toLowerCase(),
        // Confirmation immédiate avec une carte de test : le paiement aboutit
        // côté serveur (mode test), sans redirection ni saisie de carte client.
        payment_method: "pm_card_visa",
        confirm: "true",
        "automatic_payment_methods[enabled]": "true",
        "automatic_payment_methods[allow_redirects]": "never",
      });
      for (const [key, value] of Object.entries(input.metadata)) {
        body.set(`metadata[${key}]`, value);
      }

      const res = await fetch(STRIPE_PAYMENT_INTENTS_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        throw new Error(`Stripe a répondu ${res.status}`);
      }

      const intent = (await res.json()) as StripePaymentIntent;
      return {
        id: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
      };
    },
  };
}
