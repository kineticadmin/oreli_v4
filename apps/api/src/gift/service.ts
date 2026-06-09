import {
  buildOreliCatalogueBlock,
  type GiftConverseResponse,
  type GiftSessionState,
  giftSessionStateSchema,
  ORELI_SYSTEM_PROMPT,
  oreliReplySchema,
  type Product,
  SHORTLIST_MAX,
} from "@oreli/shared";
import { getCandidates, type CandidateRepository } from "../prefilter/service";
import type { GiftModel } from "./model";

/**
 * Service de dialogue cadeau (SPEC-001 · T4).
 *
 * Enchaînement : pré-filtre SQL (T3) pour borner le catalogue, construction du
 * prompt versionné, appel au modèle produit, parsing JSON strict (Zod), puis
 * résolution des produits proposés contre l'ensemble des candidats. Le service
 * ne fait jamais confiance aux identifiants renvoyés par le modèle : seuls ceux
 * présents dans les candidats (donc en stock et dans le budget) sont exposés,
 * ce qui garantit la contrainte d'acceptation du pré-filtre.
 */

/** Dépendances injectables du service de dialogue. */
export interface ConverseDeps {
  candidateRepository: CandidateRepository;
  model: GiftModel;
}

/** Levée lorsque l'état de session fourni est invalide. */
export class InvalidGiftStateError extends Error {
  constructor(
    message = "État de session invalide",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "InvalidGiftStateError";
  }
}

/** Levée lorsque la sortie du modèle ne respecte pas le contrat JSON. */
export class GiftModelError extends Error {
  constructor(
    message = "Réponse du modèle invalide",
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GiftModelError";
  }
}

/**
 * Fait avancer le dialogue cadeau d'un tour. Valide l'état (lève
 * `InvalidGiftStateError`), récupère les candidats via le pré-filtre, interroge
 * le modèle, parse sa sortie (lève `GiftModelError`), puis façonne la réponse :
 * short list (3 à 5 produits) en mode `selection`, produit unique en mode
 * `surprise`, ou aucune proposition tant que `readyToSuggest` est faux.
 */
export async function converse(
  deps: ConverseDeps,
  rawState: GiftSessionState,
): Promise<GiftConverseResponse> {
  const parsed = giftSessionStateSchema.safeParse(rawState);
  if (!parsed.success) {
    throw new InvalidGiftStateError(undefined, parsed.error.flatten());
  }
  const state = parsed.data;

  const candidates = await getCandidates(deps.candidateRepository, {
    budget: {
      minCents: state.budgetMinCents,
      maxCents: state.budgetMaxCents,
    },
    occasion: state.occasion,
    date: new Date(state.eventDate),
  });

  const raw = await deps.model.generate({
    systemPrompt: ORELI_SYSTEM_PROMPT,
    catalogueBlock: buildOreliCatalogueBlock(candidates),
    conversation: state.messages,
    context: {
      occasion: state.occasion,
      eventDate: state.eventDate,
      budgetMinCents: state.budgetMinCents,
      budgetMaxCents: state.budgetMaxCents,
      recipient: state.recipient,
    },
  });

  const replyParsed = oreliReplySchema.safeParse(raw);
  if (!replyParsed.success) {
    throw new GiftModelError(undefined, replyParsed.error.flatten());
  }
  const reply = replyParsed.data;

  const base = {
    reply: reply.reply,
    readyToSuggest: reply.readyToSuggest,
    mode: reply.mode,
    shortlist: null,
    surprise: null,
  } satisfies GiftConverseResponse;

  if (!reply.readyToSuggest) {
    return base;
  }

  // Ne retenir que les identifiants réellement présents dans les candidats :
  // le modèle peut « halluciner » un identifiant hors budget ou hors stock.
  const byId = new Map<string, Product>(candidates.map((p) => [p.id, p]));
  const resolved = (reply.productIds ?? [])
    .map((id) => byId.get(id))
    .filter((p): p is Product => p !== undefined);

  if (reply.mode === "surprise") {
    return { ...base, surprise: resolved[0] ?? null };
  }

  return { ...base, shortlist: resolved.slice(0, SHORTLIST_MAX) };
}
