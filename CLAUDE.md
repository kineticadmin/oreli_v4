# Oreli

Ce projet suit la méthode SDAD (Spec-Driven Agent Development).

- Avant toute action, lis `.claude/SYSTEM.md` : c'est la source de vérité (stack, règles absolues, conventions).
- Implémente une seule tâche de spec à la fois, depuis `.claude/specs/`. Respecte le périmètre et la section « Hors-scope » de chaque spec.
- Lance toujours `pnpm typecheck` et `pnpm test` avant d'ouvrir une Pull request.
- N'invente jamais une fonctionnalité absente de la spec ; en cas de doute, signale-le dans la Pull request.
- Ne fusionne jamais tes propres Pull requests.