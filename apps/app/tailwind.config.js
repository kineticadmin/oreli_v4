// Configuration Tailwind / NativeWind de l'application Oreli.
//
// Les couleurs et familles typographiques sont importées des tokens de design
// partagés (« Précision Chaleureuse ») afin de garder une source de vérité
// unique. Voir packages/design-tokens et .claude/SYSTEM.md § Design.
//
// Note : ce fichier est en CommonJS et consomme le build CJS de
// `@oreli/design-tokens` (dist/index.cjs), construit avant l'app par Turborepo.
const { palette, typography } = require("@oreli/design-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        navy: palette.navy,
        gold: palette.gold,
        ivory: palette.ivory,
        coral: palette.coral,
        lavender: palette.lavender,
      },
      fontFamily: {
        emotional: [typography.emotional],
        functional: [typography.functional],
      },
    },
  },
  plugins: [],
};
