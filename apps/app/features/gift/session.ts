/**
 * Logique de session du parcours cadeau côté application (SPEC-001 · T5).
 *
 * Fonctions pures qui transforment la saisie de l'écran conversationnel en
 * `GiftSessionState` validé par le schéma Zod partagé (`@oreli/shared`), puis
 * font avancer la conversation. Isolées des composants `.tsx` pour rester
 * testables sous Vitest sans moteur de rendu React Native, comme la logique de
 * style (`components/variants.ts`).
 *
 * Règle absolue (SYSTEM.md) : aucune donnée identifiante du proche ne quitte
 * l'écran ; seuls les attributs non identifiants (relation, goûts, ton) du
 * `recipientProfile` sont assemblés ici, et `.strict()` côté schéma rejette tout
 * champ supplémentaire.
 */
import {
  type ConversationMessage,
  type ConversationRole,
  type GiftMode,
  type GiftSessionState,
  giftSessionStateSchema,
} from "@oreli/shared";

/** Saisie brute de l'écran de configuration (champs texte de l'interface). */
export interface GiftSetupForm {
  /** Budget minimum en euros, tel que saisi (ex. « 20 », « 19,99 »). */
  budgetMin: string;
  /** Budget maximum en euros, tel que saisi. */
  budgetMax: string;
  /** Occasion libre (ex. « anniversaire »). */
  occasion: string;
  /** Date de l'événement au format AAAA-MM-JJ. */
  eventDate: string;
  /** Mode de proposition choisi. */
  mode: GiftMode;
  /** Type de relation, non identifiant (optionnel). */
  relationship: string;
  /** Goûts séparés par des virgules, non identifiants (optionnel). */
  tastes: string;
  /** Ton souhaité, non identifiant (optionnel). */
  tone: string;
}

/** Résultat d'assemblage : état validé, ou liste de messages d'erreur. */
export type BuildSessionResult =
  | { ok: true; state: GiftSessionState }
  | { ok: false; errors: string[] };

const EUROS_PATTERN = /^\d+([.,]\d{1,2})?$/;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convertit un montant en euros saisi (« 45 », « 45,50 ») en centiers entiers.
 * Tolère la virgule décimale (locale belge) et au plus deux décimales. Renvoie
 * `null` si la saisie n'est pas un montant valide.
 */
export function eurosToCents(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!EUROS_PATTERN.test(normalized)) {
    return null;
  }
  const euros = Number(normalized);
  if (!Number.isFinite(euros)) {
    return null;
  }
  return Math.round(euros * 100);
}

/**
 * Découpe une liste de goûts saisie au format « thé, lecture, rando » en
 * tableau nettoyé (sans entrées vides ni espaces superflus).
 */
export function parseTastes(input: string): string[] {
  return input
    .split(",")
    .map((taste) => taste.trim())
    .filter((taste) => taste.length > 0);
}

/**
 * Valide une date saisie au format AAAA-MM-JJ et la convertit en chaîne ISO
 * 8601 (minuit UTC), attendue par le schéma. Rejette les dates impossibles
 * (ex. « 2026-13-40 ») via un aller-retour. Renvoie `null` si invalide.
 */
export function isoFromDateInput(input: string): string | null {
  const trimmed = input.trim();
  if (!DATE_INPUT_PATTERN.test(trimmed)) {
    return null;
  }
  const iso = `${trimmed}T00:00:00.000Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return null;
  }
  // Garde-fou contre les débordements (« 2026-02-30 » que Date normaliserait).
  if (new Date(ms).toISOString().slice(0, 10) !== trimmed) {
    return null;
  }
  return iso;
}

/**
 * Génère un jeton de session invité non identifiant. Préfère `crypto.randomUUID`
 * quand il est disponible (navigateur moderne, cible web d'Expo) ; à défaut, se
 * rabat sur une combinaison horodatée suffisante pour un prototype.
 */
export function createGuestToken(): string {
  const cryptoObj = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (typeof cryptoObj?.randomUUID === "function") {
    return `guest-${cryptoObj.randomUUID()}`;
  }
  const stamp = Date.now().toString(36);
  const noise = Math.round(Math.random() * 1e9).toString(36);
  return `guest-${stamp}-${noise}`;
}

/**
 * Assemble et valide un `GiftSessionState` à partir de la saisie de
 * configuration, du jeton invité et du premier message adressé à Oreli. Renvoie
 * la liste des erreurs lisibles lorsqu'un champ est invalide, sans jamais
 * laisser passer un état malformé (validation finale par le schéma Zod partagé).
 */
export function buildSessionState(
  form: GiftSetupForm,
  guestToken: string,
  firstMessage: string,
): BuildSessionResult {
  const errors: string[] = [];

  const budgetMinCents = eurosToCents(form.budgetMin);
  if (budgetMinCents === null) {
    errors.push("Budget minimum invalide.");
  }

  const budgetMaxCents = eurosToCents(form.budgetMax);
  if (budgetMaxCents === null || budgetMaxCents === 0) {
    errors.push("Budget maximum invalide.");
  }

  if (
    budgetMinCents !== null &&
    budgetMaxCents !== null &&
    budgetMinCents > budgetMaxCents
  ) {
    errors.push("Le budget minimum dépasse le budget maximum.");
  }

  const eventDate = isoFromDateInput(form.eventDate);
  if (eventDate === null) {
    errors.push("Date invalide (format attendu : AAAA-MM-JJ).");
  }

  const occasion = form.occasion.trim();
  if (occasion.length === 0) {
    errors.push("Précisez l'occasion.");
  }

  const message = firstMessage.trim();
  if (message.length === 0) {
    errors.push("Écrivez un premier message à Oreli.");
  }

  if (
    errors.length > 0 ||
    budgetMinCents === null ||
    budgetMaxCents === null ||
    eventDate === null
  ) {
    return { ok: false, errors };
  }

  const relationship = form.relationship.trim();
  const tone = form.tone.trim();
  const recipient = {
    tastes: parseTastes(form.tastes),
    ...(relationship.length > 0 ? { relationship } : {}),
    ...(tone.length > 0 ? { tone } : {}),
  };

  const candidate = {
    guestToken,
    budgetMinCents,
    budgetMaxCents,
    occasion,
    eventDate,
    mode: form.mode,
    recipient,
    messages: [{ role: "user", content: message }],
  };

  const parsed = giftSessionStateSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  return { ok: true, state: parsed.data };
}

/**
 * Ajoute un tour de conversation (utilisateur ou Oreli) à l'état de session et
 * renvoie un nouvel état immuable, prêt à être renvoyé à l'API au tour suivant.
 */
export function appendMessage(
  state: GiftSessionState,
  role: ConversationRole,
  content: string,
): GiftSessionState {
  const message: ConversationMessage = { role, content };
  return { ...state, messages: [...state.messages, message] };
}
