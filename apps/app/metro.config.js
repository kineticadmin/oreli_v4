// Configuration Metro de l'application, enrichie par NativeWind pour traiter
// les classes utilitaires Tailwind (`global.css`) sur les trois cibles.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
