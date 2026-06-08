/**
 * Logique de style des composants de base (SPEC-001 · T2).
 *
 * Ces fonctions pures résolvent les classes utilitaires NativeWind à partir
 * des rôles sémantiques de design (corail = action principale, lavande =
 * moment d'IA, or = célébration — voir .claude/SYSTEM.md § Design). Elles sont
 * isolées des composants `.tsx` pour rester testables sous Vitest sans moteur
 * de rendu React Native.
 */

/** Variantes visuelles d'un bouton, alignées sur les rôles sémantiques. */
export type ButtonVariant = "primary" | "secondary" | "celebration";

/** Auteur d'une bulle de conversation. */
export type BubbleAuthor = "oreli" | "guest";

/** Classes du conteneur d'un bouton selon sa variante et son état. */
export function buttonContainerClassName(
  variant: ButtonVariant,
  disabled = false,
): string {
  const base =
    "flex-row items-center justify-center rounded-2xl px-5 py-3";
  const byVariant: Record<ButtonVariant, string> = {
    primary: "bg-coral",
    secondary: "border border-navy bg-transparent",
    celebration: "bg-gold",
  };
  return [base, byVariant[variant], disabled ? "opacity-40" : ""]
    .filter(Boolean)
    .join(" ");
}

/** Classes du libellé d'un bouton selon sa variante. */
export function buttonLabelClassName(variant: ButtonVariant): string {
  const base = "font-functional text-base font-semibold";
  const byVariant: Record<ButtonVariant, string> = {
    primary: "text-ivory",
    secondary: "text-navy",
    celebration: "text-navy",
  };
  return `${base} ${byVariant[variant]}`;
}

/** Classes du conteneur d'une bulle selon son auteur. */
export function bubbleContainerClassName(author: BubbleAuthor): string {
  const base = "max-w-[85%] rounded-2xl px-4 py-3";
  const byAuthor: Record<BubbleAuthor, string> = {
    // Lavande = moments d'IA ; la bulle d'Oreli s'aligne à gauche.
    oreli: "self-start bg-lavender",
    // L'invité s'aligne à droite, sur fond navy.
    guest: "self-end bg-navy",
  };
  return `${base} ${byAuthor[author]}`;
}

/** Classes du texte d'une bulle selon son auteur. */
export function bubbleTextClassName(author: BubbleAuthor): string {
  const base = "font-functional text-base";
  const byAuthor: Record<BubbleAuthor, string> = {
    oreli: "text-navy",
    guest: "text-ivory",
  };
  return `${base} ${byAuthor[author]}`;
}

/**
 * Met en forme un prix exprimé en centimes vers une étiquette monétaire
 * lisible (ex. 4500, "EUR" → "45,00 €" en locale belge francophone).
 */
export function formatPriceLabel(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}
