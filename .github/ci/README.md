# CI à activer manuellement

Le workflow `ci.yml` de ce dossier (lint · typecheck · test · build) fait
partie du livrable de la tâche T0.

L'agent Claude (GitHub App) ne dispose pas de la permission `workflows` et ne
peut donc pas créer de fichier sous `.github/workflows/`. **Action requise
côté humain** : déplacer ce fichier à son emplacement définitif puis commiter.

```bash
git mv .github/ci/ci.yml .github/workflows/ci.yml
git rm .github/ci/README.md
git commit -m "ci: activer le workflow lint/typecheck/test/build (T0)"
```
