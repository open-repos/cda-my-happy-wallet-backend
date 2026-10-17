# Caractérisation des contrats HTTP (M07-01)

Issue : [backend #31](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/31).
Ses dépendances #17, #18, #23 et #29 sont terminées. Cette livraison complète
les suites existantes, sans changer les routes, DTO, règles métier ou dépendances.

## Matrice de couverture

| Périmètre                                    | Contrats observables                                                                                                                                                                    | Suite npm                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Racine, santé, Swagger conditionnel          | JSON minimal, disponibilité, absence de détails internes                                                                                                                                | `test:health`                                               |
| API historique, identité et sessions         | Succès, validation, jetons invalides, propriétaire issu de l'identité authentifiée, déconnexion et limitation de débit                                                                  | `test:api`, suites `test:*session*`, `test:auth-rate-limit` |
| Catégories et opérations ponctuelles         | CRUD, conflits, dates/montants invalides, isolation, DTO publics, icônes facultatives de #84                                                                                            | `test:operations-api`, `test:budget-api-integration`        |
| Événements et occurrences calculées          | 200/201/204, Location, corps publics exacts, 400 sur identifiant mal formé, 401 avant validation sur chaque méthode, 404 étranger ou supprimé, 422 métier et formulaire, 500 assaini    | `test:monthly-events-api`                                   |
| Objectifs et prévisions                      | CRUD et DTO exacts, horloge injectable, 400/401/404/422/500, refus des montants et champs interdits sans mutation du dépôt                                                              | `test:financial-goals-api`                                  |
| Budget, historique et réalisation/annulation | Synthèse, filtres, pagination, isolation, rejeu et conflits ; 409 sur occurrence résolue ou mois clôturé                                                                                | `test:budget-projection-api`                                |
| Collections                                  | Limites et curseurs invalides, ordre stable, insertion concurrente d'opération, séparation des ressources et propriétaires                                                              | `test:pagination-integration`                               |
| Événements, occurrences et objectifs paginés | Deux pages HTTP réelles, métadonnées finales, collection vide, JWT manquant/invalide, DTO à liste de champs fermée, curseurs altérés ou repris par un autre propriétaire/ressource/mois | `test:pagination-integration`                               |

Les contrats détaillés restent définis dans `api-pagination.md`,
`monthly-event-domain.md`, `financial-goals.md`, `one-off-operation-api.md`
et `budget-projection-api.md`. La matrice distingue les preuves réutilisées
des compléments apportés aux événements, objectifs et collections.

## Compléments de M07-01

- La création, la lecture, la liste, les occurrences et la modification d'un
  événement vérifient les champs publics exacts : un champ interne ajouté par
  erreur fait échouer le test.
- Les requêtes non authentifiées sont refusées avant la validation du corps
  sur toutes les méthodes des événements et objectifs. Ces tests de routeur
  injectent l'identité ; les tests de pagination HTTP utilisent le vrai JWT.
- Les erreurs métier et inattendues conservent leur statut et leur enveloppe
  publique ; les détails du dépôt ne sont pas exposés dans une réponse 500.
- Les tests de pagination HTTP ne réimplémentent pas un décodeur de curseur
  dans leurs faux dépôts : ils utilisent les vrais dépôts sur MySQL jetable.
- Les événements sont volontairement créés dans un ordre différent de celui
  de leurs dates. Les occurrences au même dernier jour de février sont triées
  par identifiant, et la lecture des deux pages ne perd ni ne répète de ligne.

## Exécution et limites

Les suites API avec dépôts en mémoire ne nécessitent ni MySQL, ni SMTP, ni Redis.
Dans le checkout cloud isolé, définir les variables de test du workflow puis :

```bash
npm run test:monthly-events-api
npm run test:financial-goals-api
npm run test:api
```

Les scénarios SQL utilisent exclusivement la base jetable `myhappywallet_test`
sur `my-happy-wallet-mysql-test`, avec le garde-fou déjà présent dans la suite.
Ils créent et suppriment des fixtures ; ne jamais utiliser une base de
développement, de staging ou de production.

```bash
npm run db:deploy
npm run test:pagination-integration
```

GitHub Actions `Backend quality` exécute déjà ces fichiers avec MySQL et Redis.
Le checkout cloud autorise les commandes directes ; depuis le workspace parent,
suivre les commandes Docker du `AGENTS.md` parent. Aucun script npm, workflow,
schéma ou fichier de production n'est modifié. Aucun fragment de changelog
n'est nécessaire pour ces seuls tests et leur documentation.

## Preuves de sensibilité

Trois altérations temporaires ont été détectées par les nouveaux tests : ajout
d'un champ interne au DTO événement, exposition du message privé d'une erreur
de dépôt, validation du corps avant authentification sur la création d'événement.
Le code a été rétabli après chaque essai, puis les deux suites API sont repassées
au vert. Aucune de ces altérations ne fait partie du commit.
