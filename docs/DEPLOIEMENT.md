# Déploiement web — Oreli (SPEC-001 · T7)

Mise en ligne de la première tranche : l'application web (cible web d'Expo) et
l'API Hono. Deux cibles d'hébergement, une base de données Neon, et la mesure
PostHog. Tout reste en **mode test** (Stripe), aucun paiement réel.

## Vue d'ensemble

```
Visiteur ──▶ Application web (Vercel, export statique Expo)
                 │  EXPO_PUBLIC_API_URL
                 ▼
             API Hono (Railway, Node 20) ──▶ PostgreSQL (Neon)
                 │                        ──▶ Stripe (test)
                 │                        ──▶ Gemini Flash
                 ▼
             Mesure PostHog (événements clés, sans donnée identifiante)
```

## Application web — Vercel

Export statique d'Expo (`expo export --platform web`, sortie `single`/SPA). La
configuration vit dans [`apps/app/vercel.json`](../apps/app/vercel.json).

- **Build** : `pnpm --filter @oreli/app build` → `apps/app/dist`.
- **Rewrites** : toutes les routes retombent sur `index.html` (routage client
  Expo Router).
- **Racine du projet Vercel** : la racine du dépôt (le `buildCommand` filtre le
  paquet `@oreli/app`).

### Variables d'environnement (Vercel)

| Variable                   | Rôle                                              |
| -------------------------- | ------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`      | URL publique de l'API (ex. l'URL Railway ci-dessous). |
| `EXPO_PUBLIC_POSTHOG_KEY`  | Clé publique de projet PostHog (mesure web).      |
| `EXPO_PUBLIC_POSTHOG_HOST` | Hôte PostHog (repli : `https://eu.i.posthog.com`). |

Seules les variables préfixées `EXPO_PUBLIC_` sont injectées dans le bundle web.
Sans `EXPO_PUBLIC_POSTHOG_KEY`, la mesure est un no-op silencieux.

## API — Railway

Serveur Hono (Node 20). La configuration vit dans
[`apps/api/railway.json`](../apps/api/railway.json).

- **Build** : `pnpm install --frozen-lockfile && pnpm --filter @oreli/api build`.
- **Démarrage** : `pnpm --filter @oreli/api db:migrate && pnpm --filter @oreli/api start`
  (applique les migrations Prisma puis démarre le serveur).
- **Sonde de santé** : `GET /api/v1/health`.

### Variables d'environnement (Railway)

| Variable                | Rôle                                            |
| ----------------------- | ----------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL Neon (chaîne de connexion).          |
| `GEMINI_API_KEY`        | Modèle produit (Gemini Flash).                  |
| `STRIPE_SECRET_KEY`     | Stripe en **mode test**.                        |
| `STRIPE_WEBHOOK_SECRET` | Secret de webhook Stripe (test).                |
| `APP_URL`               | URL publique de l'application web (Vercel).     |
| `PORT`                  | Port d'écoute (fourni par Railway).             |

Tous les secrets proviennent de l'environnement, jamais codés en dur (SYSTEM.md).

## Base de données — Neon

1. Créer une base PostgreSQL Neon et récupérer `DATABASE_URL`.
2. Les migrations sont appliquées au démarrage (`prisma migrate deploy`).
3. Semer le catalogue curé une fois : `pnpm --filter @oreli/api db:seed`.

## Mesure — événements clés PostHog

La mesure suit le parcours acheteur via l'API de capture HTTP de PostHog
(aucune dépendance ajoutée, `fetch` injectable). Le `distinct_id` est le jeton
de session invité, non identifiant. **Aucune donnée identifiante du
destinataire** (nom, adresse) n'est jamais transmise.

| Événement              | Déclencheur                          | Propriétés                                                  |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `gift_session_started` | Lancement du dialogue avec Oreli     | `mode`, `occasion`, `budgetMinCents`, `budgetMaxCents`, `tastesCount` |
| `oreli_suggested`      | Oreli livre une proposition          | `mode`, `suggestionCount`                                  |
| `gift_selected`        | L'utilisateur retient un cadeau       | `productId`, `priceCents`, `currency`                      |
| `order_completed`      | Commande aboutie (paiement test)      | `orderId`, `productId`, `amountCents`, `currency`, `status` |

## Page de remerciement

Une commande aboutie redirige vers `/merci` (route Expo Router). Le résumé
(numéro de commande, montant, statut, `PaymentIntent`) transite par des
paramètres de route **non identifiants** : ni nom ni adresse dans l'URL.

## Vérification après déploiement

```bash
curl https://<api-railway>/api/v1/health
# => {"status":"ok","service":"oreli-api","version":"…"}
```

Depuis le web : fixer budget/occasion/date, dialoguer avec Oreli, choisir un
cadeau, régler en test, puis vérifier l'arrivée sur `/merci` et les événements
dans PostHog.
