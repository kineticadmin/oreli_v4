/**
 * Tokens de design Oreli — « Précision Chaleureuse ».
 *
 * T0 ne pose que les primitives (palette, typographies). Les composants
 * NativeWind qui les consomment relèvent de la tâche T2 (hors-scope ici).
 *
 * Référence : .claude/SYSTEM.md § Design.
 */

/** Palette de base. */
export const palette = {
  navy: "#1B2A4A",
  gold: "#C9A227",
  ivory: "#FBF7EF",
  coral: "#FF6B5E",
  lavender: "#B9A7E6",
} as const;

export type PaletteName = keyof typeof palette;

/**
 * Rôles sémantiques des couleurs (SYSTEM.md) :
 * corail = action principale, lavande = moments d'IA, or = célébration.
 */
export const semanticColors = {
  background: palette.ivory,
  foreground: palette.navy,
  primaryAction: palette.coral,
  aiMoment: palette.lavender,
  celebration: palette.gold,
} as const;

export type SemanticColorRole = keyof typeof semanticColors;

/**
 * Typographies : Playfair Display pour l'émotion, Inter pour l'interface.
 */
export const typography = {
  emotional: "Playfair Display",
  functional: "Inter",
} as const;

export type TypographyRole = keyof typeof typography;

/** Échelle d'espacement (en points), base 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;

/**
 * Résout le code hexadécimal d'un rôle sémantique de couleur.
 * Fonction de service unitaire — testée dans `test/`.
 */
export function resolveColor(role: SemanticColorRole): string {
  return semanticColors[role];
}
