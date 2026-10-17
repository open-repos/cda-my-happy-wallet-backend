# Environnement de test du backend

Ce guide remplace l'ancien environnement « cible » : Node 22, MySQL 8,
Redis et les suites `ts-node`/Supertest sont déjà utilisés par
[Backend quality](../.github/workflows/backend-quality.yml). Il ne dépend ni
d'un workspace parent ni d'un futur fichier Compose/Jest.

## Prérequis et périmètre

- Depuis un clone autonome à la racine du backend : Git, Node.js 22.13 ou
  supérieur dans la branche 22 et npm ; `npm ci` respecte le lockfile.
- Pour la validation complète locale : Docker avec accès aux images
  `node:22-bookworm`, `mysql:8.0` et `redis:8.2.1-alpine`, Bash et `curl`.
- Exécuter ces parcours dans un clone isolé sans `.env` peuplé. `dotenv` pourrait
  compléter des variables absentes avec ce fichier. Les contrôles ci-dessous
  s'arrêtent s'il existe ; ne pas supprimer sa configuration pour contourner
  ce contrôle, utiliser un autre clone.
- Une suite SQL crée, modifie et supprime des fixtures. Utiliser exclusivement
  la base jetable de ce guide, jamais développement, staging ou production.
  Ne pas exécuter `db:pull`, `db:migrate`, `migrate reset` ou le seed de comptes
  pour reproduire la validation.
- Depuis le workspace parent `my-happy-wallet`, les agents suivent son
  `AGENTS.md` et ses commandes Docker. Le parcours autonome ne remplace pas
  les règles de ce workspace.

## Première validation sans service externe

Installer et compiler comme dans le [README](../README.md), puis lancer ce
bloc dans Bash. Les variables restent dans le sous-shell ; les valeurs sont
uniquement des exemples de test. L'URL SQL n'est pas contactée par ces suites.

```bash
(
  set -eu
  test ! -e .env
  export NODE_ENV=test
  export ACCESS_TOKEN=test-access-token-secret-at-least-32-characters
  export REFRESH_TOKEN=test-refresh-token-secret-at-least-32-characters
  export REGISTER_TOKEN=test-register-token-secret-at-least-32-characters
  export DATABASE_URL=mysql://test-user:test-password@127.0.0.1:3306/myhappywallet_test
  export MAILER_DRIVER=smtp
  export SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false
  export EMAIL_SENDER=no-reply@myhappywallet.local
  unset REDIS_URL
  npm run test:health
  npm run test:api
  npm run test:operations-api
  npm run test:monthly-events-api
  npm run test:financial-goals-api
  npm run test:pagination
)
```

Chaque commande doit sortir avec le code `0`. Les suites HTTP utilisent des
faux/injections ; elles n'envoient pas de courriel réel et n'exigent pas MySQL
ou Redis. Les tests de refus/erreur peuvent produire des diagnostics attendus :
le verdict est le code de sortie et les assertions, pas l'absence totale de
texte dans stderr. La [matrice API](api-characterization-tests.md) précise
quelle frontière est réellement prouvée par chaque suite. Les suites
`test:budget-projection-api` et `test:analytics-api` traversent MySQL et restent
dans le parcours complet, comme `test:budget-api-integration` et
`test:pagination-integration`.

## Validation complète sur services jetables

Le hostname `my-happy-wallet-mysql-test` et le nom `myhappywallet_test` sont
volontaires : plusieurs tests SQL refusent un autre hôte ou nom de base.
MySQL et Redis ne publient aucun port hôte. Le stockage MySQL est en `tmpfs` ;
son contenu disparaît avec le conteneur. Les noms dédiés empêchent de réutiliser
silencieusement une stack existante : si un nom est occupé, arrêter et vérifier
à qui il appartient avant toute action.

### 1. Créer les services

Depuis la racine du clone isolé, dans un même terminal Bash :

```bash
(
  set -eu
  test ! -e .env
  docker network create mhw-docs-test
  docker run --detach --name mhw-docs-mysql-test \
    --network mhw-docs-test --network-alias my-happy-wallet-mysql-test \
    --tmpfs /var/lib/mysql \
    --env MYSQL_DATABASE=myhappywallet_test \
    --env MYSQL_USER=myhappywallet_test \
    --env MYSQL_PASSWORD=test-password \
    --env MYSQL_ROOT_PASSWORD=test-root-password \
    mysql:8.0
  docker run --detach --name mhw-docs-redis-test \
    --network mhw-docs-test redis:8.2.1-alpine
)
```

Attendre la disponibilité, avec une borne de deux minutes environ :

```bash
(
  set -eu
  for attempt in $(seq 1 60); do
    if docker exec mhw-docs-mysql-test mysqladmin ping --protocol=tcp \
      -h 127.0.0.1 -uroot -ptest-root-password --silent >/dev/null 2>&1; then
      docker exec mhw-docs-redis-test redis-cli ping
      exit 0
    fi
    sleep 2
  done
  echo 'MySQL de test indisponible : consulter ses logs.' >&2
  exit 1
)
```

Si la création de réseau/conteneur échoue, ne pas poursuivre.
Sortie attendue de la sonde : `PONG` et code `0`. En cas d'échec, ne pas continuer aux
migrations ; utiliser les diagnostics plus bas.

### 2. Exécuter les contrôles dans Node 22

Toujours dans le même terminal, définir ces variables de test. Le conteneur
Node reçoit seulement les variables explicitement listées ; le code monté doit
être le clone de test. Aucun secret de production n'est utilisé.

```bash
export NODE_ENV=test
export DATABASE_URL=mysql://myhappywallet_test:test-password@my-happy-wallet-mysql-test:3306/myhappywallet_test
export SHADOW_DATABASE_URL=mysql://myhappywallet_test:test-password@my-happy-wallet-mysql-test:3306/myhappywallet_test_shadow
export ACCESS_TOKEN=test-access-token-secret-at-least-32-characters
export REFRESH_TOKEN=test-refresh-token-secret-at-least-32-characters
export REGISTER_TOKEN=test-register-token-secret-at-least-32-characters
export MAILER_DRIVER=smtp
export SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false
export EMAIL_SENDER=no-reply@myhappywallet.local
export REDIS_URL=redis://mhw-docs-redis-test:6379

docker run --rm --network mhw-docs-test \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/app" --workdir /app \
  --env npm_config_cache=/tmp/npm-cache \
  --env NODE_ENV --env DATABASE_URL --env SHADOW_DATABASE_URL \
  --env ACCESS_TOKEN --env REFRESH_TOKEN --env REGISTER_TOKEN \
  --env MAILER_DRIVER --env SMTP_HOST --env SMTP_PORT --env SMTP_SECURE \
  --env EMAIL_SENDER --env REDIS_URL \
  node:22-bookworm bash -euc '
  test ! -e .env
  npm ci
  npm audit --omit=dev --audit-level=low
  npm audit --include=dev --audit-level=low
  npm run prisma:generate
  npm run format
  npx --no-install prettier --check README.md docs/architecture.md docs/api-contracts.md docs/test-environment.md
  npm run lint
  npm run db:deploy
  npm run type-check
  npm run test:runtime-dependencies
  npm run test:request-logging
  npm run test:services
  npm run test:mailer
  npm run test:smtp-mailer
  npm run test:create-user
  npm run test:registration-confirmation
  npm run test:registration-confirmation-controller
  npm run test:token-service
  npm run test:security-config
  npm run test:auth-rate-limit
  npm run test:http-limits
  npm run test:cors
  npm run test:password-reset
  npm run test:refresh-sessions
  npm run test:refresh-session-service
  npm run test:native-session
  npm run test:renew-session
  npm run test:health
  npm run test:delete-revenu-route
  npm run test:operations-domain
  npm run test:operations-migration
  npm run test:operation-category-icon-migration
  npm run test:operations-schema
  npm run test:operations-use-cases
  npm run test:operations-repositories
  npm run test:operations-api
  npm run test:monthly-events-domain
  npm run test:monthly-events-api
  npm run test:monthly-events-persistence
  npm run test:monthly-events-migration
  npm run test:financial-goals-domain
  npm run test:financial-goals-api
  npm run test:financial-goals-persistence
  npm run test:financial-goals-migration
  npm run test:budget-api-integration
  npm run test:budget-period-domain
  npm run test:budget-period-persistence
  npm run test:budget-period-migration
  npm run test:budget-forecast-domain
  npm run test:event-occurrences-use-cases
  npm run test:event-occurrences-persistence
  npm run test:event-occurrences-migration
  npm run test:budget-projection-api
  npm run test:budget-edge-cases
  npm run test:budget-bounded-scan
  npm run test:budget-carry-over
  npm run test:budget-carry-over-migration
  npm run test:budget-corrections
  npm run test:budget-recalculation-retry
  npm run test:analytics-domain
  npm run test:analytics-api
  npm run test:pagination
  npm run test:pagination-openapi
  npm run test:pagination-schema
  npm run test:pagination-integration
  npm run test:prisma-errors
  npm run test:result-construction
  npm run test:repositories
  npm run test:api
  npm run prisma:generate
  npm run build
'
```

Les suites correspondent à l'étape `Run service and API tests` du workflow
GitHub, avec le contrôle de compatibilité des dépendances ajouté par #37.
En cas d'évolution, synchroniser ce bloc avec le
[workflow](../.github/workflows/backend-quality.yml) et les scripts de
[package.json](../package.json). La génération explicite avant typage évite un
client Prisma périmé après changement de branche ; celle de fin reproduit la
vérification de CI. L'installation et le build écrivent dans le clone monté.

Les deux audits reproduisent les étapes bloquantes ajoutées par
[#92](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/92) après
l'installation en CI. Ils doivent sortir avec le code `0` ; une vulnérabilité
de niveau faible ou supérieur, ou une erreur de registre, interrompt le parcours.
Le [guide des dépendances](runtime-dependency-security.md#contrôle-bloquant-en-ci)
décrit le diagnostic et la reprise. Ces étapes s'ajoutent aux 60 suites sans
en changer la liste.

Résultats attendus : audits et format/lint sans échec, migrations appliquées (ou aucune
en attente à la seconde exécution), suites avec code `0`, client Prisma généré
et `dist/index.js` compilé. Les tests de migrations contiennent des étapes de
préparation/vérification qui manipulent des fixtures : ce n'est pas un parcours
de migration de production. Aucun SMTP distant n'est requis :
`test:runtime-dependencies` utilise ses propres serveurs SMTP et HTTP locaux,
tandis que `test:smtp-mailer` vérifie l'adaptateur avec un transport injecté.
`test:request-logging` vérifie la
[confidentialité du journal HTTP de développement](request-logging.md) sur
des requêtes synthétiques et le vrai serveur dans trois processus isolés.
Ces processus ne démarrent ni MySQL ni Redis et ne prouvent pas les contrôles
de démarrage de production.

`npm test` exécute seulement `type-check` et `test:operations-domain`.
`lint` et `type-check` ciblent principalement `src/` ; `format` ne couvre pas
tous les documents. Le contrôle Prettier explicite ci-dessus inclut les quatre
fichiers documentaires de #46. Ne pas annoncer une validation complète après
le seul `npm test`.

### 3. Vérifier le serveur, facultativement

Les tests API assurent déjà les statuts ; pour inspecter aussi les réponses
avec `curl`, garder les services et les exports de l'étape 2, puis lancer :

```bash
docker run --rm --name mhw-docs-api-test --network mhw-docs-test \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$PWD,target=/app" --workdir /app \
  --publish 127.0.0.1:4200:4200 --env PORT=4200 \
  --env NODE_ENV --env DATABASE_URL \
  --env ACCESS_TOKEN --env REFRESH_TOKEN --env REGISTER_TOKEN \
  --env MAILER_DRIVER --env SMTP_HOST --env SMTP_PORT --env SMTP_SECURE \
  --env EMAIL_SENDER --env REDIS_URL \
  node:22-bookworm npm start
```

Attendre `Server is now running on port 4200 ON test`. Dans un second terminal,
exécuter les quatre lectures de [api-contracts.md](api-contracts.md) : racine
`200`, liveness `200`, readiness `200` si les deux services répondent,
collection privée `401`. Ce serveur n'a pas de boîte SMTP disponible : ne pas
l'utiliser pour un essai d'inscription/envoi réel. Arrêter par `Ctrl+C`.

### 4. Nettoyer uniquement cet environnement

Après l'arrêt du serveur facultatif, ces commandes suppriment uniquement les
deux conteneurs nommés de ce guide et leur réseau. Leur base est jetable ;
aucune commande globale de nettoyage ou de suppression de volume n'est nécessaire.

```bash
docker rm --force mhw-docs-mysql-test mhw-docs-redis-test
docker network rm mhw-docs-test
unset DATABASE_URL SHADOW_DATABASE_URL REDIS_URL
unset ACCESS_TOKEN REFRESH_TOKEN REGISTER_TOKEN
unset NODE_ENV MAILER_DRIVER SMTP_HOST SMTP_PORT SMTP_SECURE EMAIL_SENDER
```

## Diagnostics et reprise

| Symptôme                                    | Vérification et correction                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Le contrôle `test ! -e .env` échoue         | Utiliser un nouveau clone sans `.env`, conserver intacte la configuration existante.                                                                                           |
| Secret absent, trop court ou dupliqué       | Les trois exports doivent être distincts et avoir au moins 32 caractères ; `src/config/securityConfig.ts` bloque avant les requêtes. Ne pas afficher une configuration réelle. |
| Module Prisma/champ `icon` absent au typage | Régénérer avec `npm run prisma:generate` après `npm ci`, depuis le schéma de la branche courante.                                                                              |
| Refus de la base par un test                | Vérifier nom `myhappywallet_test` et alias `my-happy-wallet-mysql-test` dans le réseau Docker ; ne jamais désactiver le garde-fou.                                             |
| `P1001` ou MySQL non prêt                   | `docker logs mhw-docs-mysql-test`, refaire la sonde puis `npm run db:deploy` dans le conteneur Node ; pas de `migrate reset` sur une autre base.                               |
| Readiness `503`                             | Vérifier MySQL puis `docker exec mhw-docs-redis-test redis-cli ping` ; les sondes ne révèlent pas le détail d'erreur au client.                                                |
| Échec de connexion Redis au démarrage       | Dans le parcours complet, garder son export réseau ; hors production uniquement, sans Redis voulu, retirer `REDIS_URL` de toute configuration chargée.                         |
| `401` / `403` / `422` HTTP                  | Distinguer token expiré, rôle admin, champs interdits et contexte du curseur ; consulter les [contrats](api-contracts.md). Ne pas désactiver l'authentification.               |
| Port 4200 déjà utilisé                      | Arrêter son propre serveur ou changer le port hôte de `--publish` et adapter les commandes `curl`.                                                                             |
| Un test SQL échoue après interruption       | Nettoyer uniquement les conteneurs de ce guide puis repartir sur une base jetable neuve ; conserver le code et les logs nécessaires au diagnostic.                             |

La CI GitHub sur la PR constitue la validation complète si le checkout cloud ne
fournit pas Docker. Distinguer dans le bilan les suites réellement exécutées
localement, la vérification statique des commandes Docker et l'exécution des
suites MySQL/Redis en CI. Le bloc Docker est un équivalent autonome du workflow,
pas un fichier Compose déjà présent dans ce dépôt.

Une modification de ces documents se rétablit par un commit de revert. Les
procédures de [CI/CD](ci-cd.md) et de [sauvegarde/restauration](backup-and-restore.md)
couvrent le retour à l'image précédente et la reprise des données ; elles ne
sont pas exécutées pendant la validation documentaire.
