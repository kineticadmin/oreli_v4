import type { GiftModel, GiftModelRequest } from "./model";

/**
 * Adaptateur Gemini Flash du port `GiftModel` (SPEC-001 · T4).
 *
 * Comme les dépôts Prisma, cet adaptateur est la frontière réseau : il n'est pas
 * couvert par les tests unitaires (qui injectent un modèle déterministe) ; la
 * logique métier testée vit dans `service.ts`.
 *
 * Cache de prompt (SPEC-001) : le prompt système et le bloc catalogue forment un
 * préfixe stable placé dans `system_instruction`. Gemini Flash applique un cache
 * implicite sur les préfixes stables ; le bloc catalogue, identique d'un tour à
 * l'autre d'une même demande, en bénéficie. Le coût marginal d'un tour se réduit
 * alors aux tokens de la conversation.
 */

/** Modèle produit (SYSTEM.md : Gemini Flash, coût minimal par requête). */
export const GEMINI_MODEL = "gemini-flash-latest";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

/** Mappe nos rôles de conversation vers ceux attendus par Gemini. */
function toGeminiRole(role: "user" | "oreli"): "user" | "model" {
  return role === "oreli" ? "model" : "user";
}

/** Sérialise le contexte non identifiant de la demande pour le modèle. */
function buildContextLine(context: GiftModelRequest["context"]): string {
  const budgetEur = (cents: number): string => (cents / 100).toFixed(2);
  const tastes =
    context.recipient.tastes.length > 0
      ? context.recipient.tastes.join(", ")
      : "non précisés";
  return [
    `Contexte de la demande : occasion=${context.occasion}`,
    `date=${context.eventDate}`,
    `budget=${budgetEur(context.budgetMinCents)}–${budgetEur(context.budgetMaxCents)} EUR`,
    `relation=${context.recipient.relationship ?? "non précisée"}`,
    `ton=${context.recipient.tone ?? "non précisé"}`,
    `goûts=${tastes}`,
  ].join(" | ");
}

/**
 * Construit un adaptateur Gemini Flash. `apiKey` provient de `GEMINI_API_KEY`
 * (SYSTEM.md : secrets via l'environnement, jamais en dur).
 */
export function createGeminiGiftModel(apiKey: string): GiftModel {
  return {
    async generate(request: GiftModelRequest): Promise<unknown> {
      // Préfixe stable mis en cache : prompt système + catalogue des candidats.
      const systemInstruction = {
        parts: [
          { text: request.systemPrompt },
          { text: request.catalogueBlock },
        ],
      };

      // Le contexte non identifiant varie par tour : il est replié dans le
      // premier message utilisateur plutôt que dans le préfixe mis en cache.
      const contextLine = buildContextLine(request.context);
      const contents = request.conversation.map((message, index) => ({
        role: toGeminiRole(message.role),
        parts: [
          {
            text:
              index === 0
                ? `${contextLine}\n\n${message.content}`
                : message.content,
          },
        ],
      }));

      const res = await fetch(
        `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction,
            contents,
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Gemini a répondu ${res.status}`);
      }

      const body = (await res.json()) as GeminiResponse;
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text === undefined) {
        throw new Error("Réponse Gemini sans contenu texte");
      }

      return JSON.parse(text);
    },
  };
}
