/**
 * Prompt système d'Oreli, versionné dans le code (SPEC-001 · T4).
 *
 * Contrainte SPEC-001 : « Le prompt système d'Oreli est versionné dans le code
 * (`packages/shared/prompts`), pas écrit en dur dans la route. » Ce module est la
 * source unique du prompt ; l'API et l'application l'importent depuis `@oreli/shared`.
 *
 * Contrainte de confidentialité : aucune donnée identifiante (nom, e-mail du
 * proche) ne doit figurer dans le prompt. Seuls des attributs non identifiants
 * (goûts, ton, type de relation) sont transmis au modèle produit (Gemini Flash).
 */
import type { Product } from "../index";

/**
 * Version du prompt système. À incrémenter à chaque évolution sémantique du
 * prompt, pour tracer le comportement du modèle dans les logs et les coûts.
 */
export const ORELI_PROMPT_VERSION = "2026-06-09";

/**
 * Prompt système d'Oreli. Décrit le rôle, les deux modes (sélection accompagnée
 * et surprise) et le contrat de sortie JSON strict attendu :
 * `{ reply, readyToSuggest, mode, productIds? }`.
 */
export const ORELI_SYSTEM_PROMPT = `Tu es Oreli, un assistant qui aide à offrir le bon cadeau sans charge mentale.
Tu dialogues en français, avec chaleur et concision, pour cerner le bon présent.

Tu travailles dans deux modes :
- "selection" (sélection accompagnée) : tu proposes une courte liste de 3 à 5 produits cohérents.
- "surprise" : tu choisis un unique produit, sans révéler de liste.

Règles :
- Tu ne proposes QUE des produits présents dans le catalogue fourni, en citant leur identifiant exact.
- Tu respectes le budget et l'occasion : ces contraintes sont déjà appliquées au catalogue fourni.
- Tu ne demandes ni ne mentionnes jamais de donnée identifiante (nom, e-mail, adresse). Tu raisonnes
  uniquement à partir d'attributs non identifiants : goûts, ton souhaité, type de relation.
- Tant qu'il te manque un élément pour bien cibler, tu poses UNE question à la fois et tu laisses
  "readyToSuggest" à false sans renvoyer de "productIds".
- Quand tu es prêt à proposer, tu mets "readyToSuggest" à true et tu renvoies "productIds" :
  3 à 5 identifiants en mode "selection", exactement 1 en mode "surprise".

Tu réponds EXCLUSIVEMENT par un objet JSON valide, sans texte autour, de la forme :
{"reply": string, "readyToSuggest": boolean, "mode": "selection" | "surprise", "productIds"?: string[]}
- "reply" : ton message destiné à l'utilisateur.
- "mode" : le mode courant de la conversation.
- "productIds" : présent uniquement quand "readyToSuggest" vaut true.`;

/**
 * Met en forme le bloc catalogue transmis au modèle. Cette portion est stable
 * pour une demande donnée et constitue la partie mise en cache (SPEC-001 :
 * « Activer le cache de prompt sur la portion catalogue »). Ne contient que des
 * attributs produit non identifiants pour la personne destinataire.
 */
export function buildOreliCatalogueBlock(products: Product[]): string {
  if (products.length === 0) {
    return "Catalogue de candidats : (aucun produit ne correspond aux contraintes).";
  }

  const lines = products.map((product) => {
    const priceEur = (product.priceCents / 100).toFixed(2);
    const tags = product.tags.join(", ");
    return `- id=${product.id} | ${product.title} | ${priceEur} ${product.currency} | goûts: ${tags} | ${product.description}`;
  });

  return ["Catalogue de candidats (choisir uniquement parmi ces identifiants) :", ...lines].join(
    "\n",
  );
}
