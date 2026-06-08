# SPEC-001 · Parcours cadeau acheteur (prototype web)

## Statut
À faire. Première tranche livrable (V4.0).

## Dépendances
Aucune. Dépôt neuf. L'initialisation est la tâche T0 ci-dessous.

## Effort estimé
5 à 8 nuits d'agent (tâches T0 à T7), avec une revue humaine chaque matin.

## Objectif
Prouver la magie acheteur : un visiteur fixe budget, occasion et date, dialogue avec Oreli, et reçoit soit une courte sélection, soit une surprise, puis paie en mode test. Déploiement web d'abord (cible web d'Expo) ; la même base servira ensuite le mobile.

## Périmètre (dans la tranche)
- Monorepo + API + application Expo (cible web).
- Catalogue **semé à la main** : 20 à 30 produits de vrais artisans bruxellois (données curées dans un script de seed JSON).
- Endpoint de dialogue Oreli (Gemini Flash) avec pré-filtre SQL.
- Deux modes : **sélection accompagnée** et **surprise** (totale / encadrée).
- **Session invité** (token), sans compte complet.
- Checkout **Stripe en mode test** (PaymentIntent) et création de commande.
- Application des tokens de design (Précision Chaleureuse).

## Hors-scope (explicite, ne pas implémenter)
- Console vendeur, onboarding vendeur, KYB.
- Comptes utilisateurs / Better Auth (la session invité suffit).
- Offres graduées, abonnements.
- pgvector, embeddings, recherche par image.
- Redis / BullMQ, e-mails transactionnels avancés.
- Paiement réel (live), payouts vendeurs.
- Empaquetage mobile pour les stores (la cible web suffit pour cette tranche).

## Modèle de données (Prisma, minimal)
- `Vendor(id, name, slug, city, createdAt)`
- `Product(id, vendorId, title, description, priceCents, currency='EUR', imageUrl, tags[], occasionTags[], inStock: boolean, createdAt)`
- `GiftSession(id, guestToken, budgetMinCents, budgetMaxCents, occasion, eventDate, recipientNotes, mode, messages: Json, status, shortlist: Json?, selectedProductId?, createdAt)`
- `Order(id, giftSessionId, productId, amountCents, stripePaymentIntentId, status, recipient: Json, deliveryDate, createdAt)`

## Contraintes techniques
- Rappel des règles de `SYSTEM.md` (zéro `any`, Zod partout, etc.).
- Le pré-filtre SQL borne le budget `[min, max]`, exige `inStock = true`, et matche au moins un `occasionTags`. **Maximum 40 candidats** passés au modèle.
- Le prompt système d'Oreli est versionné dans le code (`packages/shared/prompts`), pas écrit en dur dans la route.
- Aucune donnée identifiante (nom, e-mail du proche) envoyée à Gemini : ne transmettre que des attributs non identifiants (goûts, ton, type de relation).
- Réponse du modèle parsée en JSON strict via un schéma Zod : `{ reply, readyToSuggest, mode, productIds? }`.
- Activer le cache de prompt sur la portion catalogue pour minimiser le coût.

## Tâches
- **T0 · Initialiser le monorepo.** Turborepo + pnpm ; `apps/app` (Expo + Expo Router, cible web activée), `apps/api` (Hono), `packages/shared` (types + schémas Zod), `packages/design-tokens`. CI GitHub Actions (lint, typecheck, test, build). Endpoint `GET /api/v1/health`. PR.
- **T1 · Données.** Schéma Prisma + migration + script de seed (25 produits curés en JSON). Endpoint `GET /api/v1/products` (pagination par curseur). Tests. PR.
- **T2 · Design.** Tokens (couleurs, typographies) + composants de base NativeWind : boutons, carte produit, bulle de conversation. PR.
- **T3 · Pré-filtre.** Service `getCandidates({ budget, occasion, date })` qui renvoie 40 produits max. Tests. PR.
- **T4 · Oreli (IA).** Prompt système, appel Gemini Flash, parsing Zod, cache de prompt sur le catalogue. Endpoint `POST /api/v1/gift/converse` : état de session en entrée, message d'Oreli en sortie, plus la sélection ou la surprise quand `readyToSuggest`. Tests. Documenter le coût estimé d'une suggestion dans la PR.
- **T5 · Écran conversationnel.** Saisie budget/occasion/date, dialogue, affichage de la short list ou de la surprise, choix final. PR.
- **T6 · Checkout.** Stripe en mode test : PaymentIntent, écran de paiement, création de l'`Order`, écran de confirmation. Tests. PR.
- **T7 · Déploiement.** Mise en ligne web (Vercel ou Railway), variables d'environnement, page de remerciement, événements clés PostHog. PR.

## Critères d'acceptation
- Depuis le web, un visiteur peut fixer budget/occasion/date, échanger avec Oreli, et obtenir soit une sélection de 3 à 5 produits cohérents avec le budget et l'occasion, soit une surprise unique.
- Le mode surprise renvoie un seul produit, sans révéler de liste.
- Le pré-filtre garantit que seuls des produits en stock et dans le budget sont proposés.
- Un paiement de test Stripe aboutit et crée une commande en base avec le bon montant.
- `pnpm typecheck` et `pnpm test` passent ; zéro `any` ; toutes les entrées API validées par Zod.
- Aucune donnée identifiante du proche n'apparaît dans les requêtes au modèle.
- Le coût estimé d'une suggestion (entrées + sorties, cache activé) est documenté dans la PR de T4.

## Variables d'environnement
`DATABASE_URL`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY` (test), `STRIPE_WEBHOOK_SECRET` (test), `POSTHOG_KEY`, `APP_URL`.
