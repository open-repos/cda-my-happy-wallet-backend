# My Happy Wallet — backend

API Express/TypeScript de gestion budgétaire : opérations fixes et ponctuelles,
catégories personnelles, événements prévisionnels, objectifs et reste à vivre.
Le code est intégré dans `develop` ; `main` est réservé aux releases validées.
Les issues et PR sont suivies sur
[GitHub](https://github.com/open-repos/cda-my-happy-wallet-backend).

## Démarrer depuis un clone

Prérequis : Git, Node.js 22.13 ou supérieur dans la branche 22, et npm.
MySQL 8 est nécessaire pour les fonctions persistées ; Docker est nécessaire
pour le parcours de validation complet isolé décrit ci-dessous.

```bash
git clone --branch develop https://github.com/open-repos/cda-my-happy-wallet-backend.git
cd cda-my-happy-wallet-backend
npm ci
npm run prisma:generate
npm run type-check
npm run build
```

Ces commandes installent le lockfile et produisent `dist/index.js`. Elles ne
créent pas de base de données. Suivre ensuite
[l'environnement de test](docs/test-environment.md) pour les variables de test,
les premières suites sans services, puis MySQL/Redis jetables. `npm test` ne
couvre qu'une partie de la validation ; les suites actuelles sont des scripts
`ts-node` avec `assert` et Supertest, sans configuration Jest.

Pour lancer le serveur compilé avec une configuration locale préparée depuis
[.env.example](.env.example), utiliser `npm start`. Le port de l'exemple est
`4200` ; `GET /v1/` identifie l'API et `GET /health/ready` vérifie ses dépendances.
Les trois secrets JWT doivent être distincts et contenir au moins 32 caractères.
L'exemple configure aussi Redis et SMTP : ces services doivent être disponibles
pour les fonctionnalités qui les utilisent. Voir les diagnostics du guide de test.

## Documentation à suivre

| Besoin                                                | Point d'entrée                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Comprendre les modules, dépendances et décisions      | [Architecture](docs/architecture.md)                                                                       |
| Consommer les routes, DTO et erreurs existants        | [Contrats API](docs/api-contracts.md)                                                                      |
| Reproduire les contrôles et diagnostiquer un échec    | [Environnement de test](docs/test-environment.md)                                                          |
| Retrouver les preuves HTTP exécutables                | [Matrice de caractérisation](docs/api-characterization-tests.md)                                           |
| Livrer une PR vers `develop`                          | [Contribution](CONTRIBUTING.md), [règles agents](AGENTS.md), [automatisation](docs/delivery-automation.md) |
| Comprendre le déploiement manuel et le retour arrière | [CI/CD](docs/ci-cd.md), [sauvegarde/restauration](docs/backup-and-restore.md)                              |

La documentation décrit le code présent, y compris ses conventions historiques.
Une évolution de contrat nécessite une issue, des tests, une mise à jour des
documents affectés et un fragment selon [changes/README.md](changes/README.md).
