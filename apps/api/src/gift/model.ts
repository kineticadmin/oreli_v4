import type { ConversationMessage, RecipientProfile } from "@oreli/shared";

/**
 * Requête adressée au modèle produit (Gemini Flash). Le prompt système et le
 * bloc catalogue forment un préfixe stable (mis en cache, SPEC-001) ; la
 * conversation et le contexte non identifiant varient d'un tour à l'autre.
 *
 * Aucune donnée identifiante n'est présente : `recipient` est un profil
 * d'attributs non identifiants (goûts, ton, type de relation).
 */
export interface GiftModelRequest {
  /** Prompt système versionné (préfixe stable, mis en cache). */
  systemPrompt: string;
  /** Bloc catalogue des candidats (préfixe stable, mis en cache). */
  catalogueBlock: string;
  /** Tours de conversation échangés jusqu'ici. */
  conversation: ConversationMessage[];
  /** Contexte non identifiant de la demande. */
  context: {
    occasion: string;
    /** Date de l'occasion, en chaîne ISO 8601. */
    eventDate: string;
    budgetMinCents: number;
    budgetMaxCents: number;
    recipient: RecipientProfile;
  };
}

/**
 * Port du modèle produit. L'implémentation de production (Gemini Flash) effectue
 * l'appel réseau ; les tests injectent une implémentation déterministe. Le port
 * renvoie la valeur JSON brute du modèle (`unknown`), validée par le service via
 * `oreliReplySchema` — la validation Zod reste l'unique frontière de confiance.
 */
export interface GiftModel {
  generate(request: GiftModelRequest): Promise<unknown>;
}
