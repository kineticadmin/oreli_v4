# ORELI V4 · Contexte global

> À charger au début de CHAQUE session Claude Code, avant toute tâche.

## Mission

Effacer la charge mentale du cadeau, jusqu'à rendre le geste presque automatique. L'utilisateur fixe un budget, une occasion et une date ; Oreli propose, soit une courte sélection, soit une surprise. Pour un proche ou pour soi, avec ou sans occasion. Simple sans être simpliste.

## Principe des deux IA

- **Cerveau du produit** (runtime, sert l'utilisateur à chaque suggestion) : **Gemini Flash**. Critère : coût minimal par requête.
- **Agents de construction** (ce dépôt, la nuit) : **Claude Code**. Critère : autonomie et qualité de code.

Ne jamais utiliser un modèle cher pour le runtime à fort volume. Le modèle produit ne reçoit jamais de données personnelles.

## Stack

- **Application** (iOS + Android + Web) : Expo + Expo Router + React Native Web. Style : NativeWind + tokens partagés. Une seule base de code pour les trois cibles.
- **API** : Hono.js (Node 20), tous les endpoints sous `/api/v1/`.
- **Validation** : Zod sur toutes les entrées.
- **DB** : PostgreSQL (Neon) via Prisma. **Pas de pgvector** pour l'instant.
- **IA produit** : Gemini Flash. **Aucun embedding** pour l'instant.
- **Auth** : Better Auth (hors périmètre de SPEC-001).
- **Paiement** : Stripe Connect (mode test au départ).
- **E-mail** : Resend. **Mesure** : PostHog.
- **Monorepo** : Turborepo + pnpm. **CI** : GitHub Actions.

## Règles absolues

- TypeScript strict, **zéro `any`**.
- Zod sur toutes les entrées API ; erreurs au format `ApiError { code, message, details }` en JSON.
- `SELECT FOR UPDATE` dans une transaction Prisma pour toute écriture de stock.
- Pagination par curseur (`created_at` + `id`), jamais LIMIT/OFFSET.
- Secrets depuis `process.env`, jamais en dur.
- Logging JSON structuré, pas de `console.log`.
- Un test Vitest par fonction de service.
- **Aucune donnée personnelle identifiante dans les prompts** envoyés au modèle produit.

## Méthode (SDAD)

- Le travail suit les fichiers de `.claude/specs/`. Respecter strictement le périmètre et la section « Hors-scope » de chaque spec.
- Avancer par tâches atomiques. Une Pull Request par tâche (ou par spec si elle est petite).
- Ne jamais inventer une fonctionnalité absente de la spec. En cas de doute, le signaler dans la PR plutôt que d'élargir le périmètre.

## Boucle nocturne et revue

- L'agent code, lance `pnpm typecheck` et `pnpm test`, puis ouvre une Pull Request avec un résumé clair des décisions.
- **Rien n'est fusionné sans revue humaine.** La PR est l'artefact de compréhension : description, différences, tests au vert.
- Outils autorisés limités au strict nécessaire ; points de sauvegarde Git pour pouvoir revenir en arrière.

## Design (Précision Chaleureuse)

- Playfair Display pour les moments d'émotion, Inter pour l'interface fonctionnelle.
- Palette : navy, or, ivoire. Rôles sémantiques : corail = action principale, lavande = moments d'IA, or = célébration.

## Pas encore implémenté (ne pas inventer)

- [Tenir cette liste à jour au fil des Pull Requests fusionnées.]
