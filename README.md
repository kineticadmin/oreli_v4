# Oreli

Effacer la charge mentale du cadeau. Voir `.claude/SYSTEM.md` (contexte global)
et `.claude/specs/` (spécifications SDAD).

## Monorepo

Turborepo + pnpm. Une seule base de code pour le web, l'iOS et l'Android.

```
apps/
  api/              API Hono (Node 20), endpoints sous /api/v1/
  app/              Application Expo + Expo Router (cible web activée)
packages/
  shared/           Types et schémas Zod partagés (ApiError, santé, …)
  design-tokens/    Tokens « Précision Chaleureuse » (palette, typographies)
```

## Prérequis

- Node 20+
- pnpm 9 (`corepack enable`)

## Commandes

```bash
pnpm install        # installe toutes les dépendances de l'espace de travail
pnpm dev            # lance les serveurs de développement (turbo)
pnpm typecheck      # vérification TypeScript (zéro any)
pnpm test           # tests Vitest
pnpm lint           # ESLint
pnpm build          # build de tous les paquets
```

### API

```bash
pnpm --filter @oreli/api dev     # http://localhost:3000
curl http://localhost:3000/api/v1/health
# => {"status":"ok","service":"oreli-api","version":"0.0.0"}
```

### Application (web)

```bash
pnpm --filter @oreli/app web     # ouvre la cible web d'Expo
```

## Variables d'environnement

Copier `.env.example` vers `.env`. Aucun secret n'est codé en dur (SYSTEM.md).

## Méthode

Développement piloté par les specs (SDAD). Une Pull Request par tâche ;
revue humaine obligatoire avant toute fusion.
