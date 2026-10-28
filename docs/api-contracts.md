# Contrats HTTP du backend

Guide transversal de [M11-02 / #46](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/46).
Les tableaux décrivent les routes actuellement montées, sans changement de
comportement. Les liens spécialisés détaillent les règles et leurs limites.
Pour reproduire les exemples, préparer [l'environnement de test](test-environment.md).

Le [rapprochement des enveloppes](budget-reconciliation.md) est réservé aux
charges mensuelles explicitement marquées. Il ajuste les soldes et reports,
avec saisie atomique des paiements, suivi mensuel/annuel, moyennes par catégorie
et modifications datées des charges/revenus. `integration.globalBudgetAdjusted`
vaut `true` ; les anciens bilans clôturés restent préservés.

## Adresse, formats et authentification

Les chemins métier sont relatifs à `APP_BASE_URL`, `/v1` par défaut ; le port
de [.env.example](../.env.example) est `4200`. `/health/live`, `/health/ready`
et `/api-docs` sont hors préfixe. Swagger est exposé si `API_DOCS_ENABLED`
l'autorise (faux par défaut en production, vrai ailleurs). `/` redirige vers
Swagger uniquement lorsqu'il est activé. La [racine JSON](api-root.md) reste
indépendante de cette option.

Les routes privées utilisent `Authorization: Bearer <access-token>`.
Le propriétaire vient du JWT vérifié, jamais du cookie `id_user`, du corps ou
de la query. Le rôle administrateur ne donne pas d'accès transversal aux
ressources personnelles. `GET /users` demande le rôle `ADMIN`, relu en base.

Toute réponse sous `APP_BASE_URL`, succès comme erreur, porte
`Cache-Control: private, no-store`, sans `ETag` ni `304` : voir la
[politique de cache privée](private-http-cache.md).

Les modules récents exposent les montants en chaînes à deux décimales
(`"12.30"`), les dates métier en `YYYY-MM-DD` et les mois en `YYYY-MM`.
Les instants techniques publiés, comme `resolvedAt`, sont des dates ISO avec
heure. Un changement de fuseau ne doit pas déplacer une date civile. Aucune
conversion implicite de devise n'est effectuée. Le jour courant des
prévisions vient de l'horloge injectable `Europe/Paris`.

## Identification et sondes publiques

| Méthode et chemin             | Succès         | Réponse / effet                                                                    |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `GET /` sous la base (`/v1/`) | `200`          | `{name, version, status, health}` ; aucune sonde de dépendance                     |
| `GET /health/live` hors base  | `200`          | `{"status":"ok"}`, sans dépendance                                                 |
| `GET /health/ready` hors base | `200` ou `503` | `{"status":"ok"}` ou `{"status":"unavailable"}` selon MySQL et le magasin de débit |

Les sondes ont `Cache-Control: no-store` et ne publient aucun détail de panne.
Les champs exacts de la racine sont définis dans [api-root.md](api-root.md).

## Comptes et sessions

Les JWT portent un `iss` vérifié et une audience propre à leur usage (accès,
renouvellement, confirmation). Les jetons sans ces claims sont refusés.
Les routes, enveloppes, cookies et durées ci-dessous restent identiques ; les
clients traitent les jetons comme des valeurs opaques. La première livraison
nécessite une reconnexion et régénère les liens de confirmation encore en
attente : voir la [politique et la bascule JWT](jwt-issuer-audience.md).

Ces routes conservent leurs conventions historiques : les corps invalides
utilisent `400 IncompleteRequestBody`, pas le `422` des nouveaux modules.

| Méthode et chemin                    | Entrée / accès                                                           | Succès observable                                                               |
| ------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `POST /users/register`               | Public ; `firstname`, `lastname`, `email`, `password`, `confirmpassword` | `201`, `{succes, message}` ; création et courriel de confirmation               |
| `GET /users/verify/:id/:token`       | Lien de confirmation, pas de Bearer                                      | Redirection vers le login ; différences HTML/JSON ci-dessous                    |
| `POST /users/authenticate`           | Public, `{email, password}`                                              | `200`, `{success, payload: {user, accessToken, expires}}` et cookies de session |
| `POST /token`                        | `{email, grant_type}` et cookie `refresh_token`                          | `200`, même enveloppe de session ; rotation du renouvellement                   |
| `POST /users/logout`                 | Cookie de renouvellement si présent                                      | `204` sans corps, cookies effacés ; requête répétable                           |
| `POST /users/reset-password`         | Public, `{email}`                                                        | `201`, `{succes, message}` générique contre l'énumération                       |
| `GET /users/reset-password/:token`   | Lien de récupération                                                     | `201`, `{succes, message}` et cookie `reset_token_password`                     |
| `POST /users/new-password`           | `{password, confirmPassword}` et cookie de récupération                  | `201`, `{succes, message}` ; cookie effacé                                      |
| `DELETE /users/delete`               | Bearer et corps avec `email`                                             | `200`, `{success, message}` ; identité issue du JWT, cookies de session effacés |
| `GET /users`                         | Bearer et rôle `ADMIN`                                                   | `200`, collection paginée avec sélection de champs publics                      |
| `POST /auth/native/sessions`         | Public, `{email, password}`                                              | `200`, enveloppe `success/payload` avec jetons d'accès et de renouvellement     |
| `POST /auth/native/sessions/refresh` | `{refreshToken}`                                                         | `200`, jetons renouvelés dans `payload`                                         |
| `POST /auth/native/sessions/revoke`  | `{refreshToken}`                                                         | `204` sans corps ; révocation répétable pour un corps valide                    |

`grant_type` vaut `refresh_token` ; voir le
[schéma](../src/utils/validators/renewRefreshToken.validator.ts).
Les orthographes `succes` et `success` sont existantes et doivent être
préservées. Le JWT d'accès initial dure 60 secondes ; après renouvellement il
dure 300 secondes. Les sessions de renouvellement durent 900 secondes et sont
tournées à chaque renouvellement. Le client conserve le nouveau jeton et
évite les renouvellements concurrents : un rejeu n'est pas un succès idempotent.
Voir [RefreshSessionService](../src/modules/auth/refreshSession/RefreshSessionService.ts).

Sur le Web, `refresh_token` et `id_user` sont `HttpOnly`, `SameSite=Strict`,
`Path=/`, et `Secure` en production. Le cookie d'identifiant n'est pas une
preuve d'identité. Le client natif reçoit explicitement le jeton de
renouvellement et les durées `accessTokenExpiresIn` / `refreshTokenExpiresIn`.
Les réponses métier ne doivent jamais réexposer ces secrets.

La confirmation réussie redirige vers le login. Un lien déjà utilisé ou
invalide avec un `Accept` contenant explicitement `text/html` redirige en `303`
avec `confirmation=already-used` ou `invalid-or-expired`. Sans cet en-tête,
ces erreurs restent JSON `409` ou `401`. Ne pas déduire ce comportement du seul
statut de succès historique affiché dans Swagger. Preuves :
[ConfirmRegistrationUserController.test.ts](../test/modules/user/ConfirmRegistrationUserController.test.ts).

## Opérations fixes historiques

Toutes exigent le Bearer. `{type}` désigne seulement `revenus` ou `charges`,
pas un segment littéral ni une troisième route générique.

| Méthode et chemin                     | Entrée                       | Succès                                                 |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `GET /operations-fixes`               | `limit`, `cursor`            | `200`, `{data, meta}`                                  |
| `GET /operations-fixes/{type}`        | `limit`, `cursor`            | `200`, `{data, meta}` filtrés par sens                 |
| `POST /operations-fixes/{type}`       | `titre`, `montant`, `devise` | `201`, `{success, message, data}`                      |
| `GET /operations-fixes/{type}/:id`    | Identifiant de chemin        | `200`, enveloppe historique `{success, message, data}` |
| `PUT /operations-fixes/{type}/:id`    | `titre`, `montant`, `devise` | `200`, `{success, message}`                            |
| `DELETE /operations-fixes/{type}/:id` | Identifiant de chemin        | `200`, `{success, message}` ; pas `204`                |

Les champs publics historiques sont `idOperationFixe`, `titre`, `montant`,
`devise` et, pour la liste, `typeOperation` (`REVENU` / `CHARGE`). Ne pas leur
appliquer automatiquement le DTO anglais ni la sérialisation monétaire des
opérations ponctuelles. Les charges ajoutent `periodicite`,
`pourcentagePersonnel`, `montantPersonnel` et `montantMensuelPersonnel`, selon
le [contrat des charges périodiques](fixed-charge-budgeting.md). POST/PUT de
charge acceptent les deux premiers champs ; omettre ces champs sur PUT les
conserve. Leur validation historique supprime les champs inconnus et retourne
`400`. Les lectures, modifications et suppressions unitaires filtrent aussi le
type et retournent désormais `404` pour une ressource absente, étrangère ou du
mauvais type. Sources : [routeur](../src/routes/operationsFixes.ts),
[repository](../src/modules/operationsFixes/operationFixeRepo.ts) et
[tests de données](../test/modules/repositories/RepositoriesDataAccess.test.ts).

## Ressources personnelles récentes

Toutes exigent le Bearer. Un succès unitaire est `{ "data": ... }` ; une liste
est `{ "data": [], "meta": ... }`. `PUT` reçoit le corps de remplacement,
pas un patch arbitraire. Pour les catégories, omettre `icon` sur `PUT` conserve
l'icône et `null` la retire, selon le [contrat des icônes](operation-category-icons.md).

| Méthodes et chemins                                                    | Succès                                       | Entrée / référence                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /operation-categories`, `POST /operation-categories`              | `200` liste / `201` création                 | `name`, `color?`, `icon?` ; [catégories](one-off-operation-api.md)                                            |
| `PUT /operation-categories/:id`, `DELETE /operation-categories/:id`    | `200` / `204`                                | Pas de route GET unitaire de catégorie                                                                        |
| `GET /operations`, `POST /operations`                                  | `200` liste / `201` création avec `Location` | Filtres `from`, `to`, `currency` ; corps `title`, `amount`, `currency`, `kind`, `operationDate`, `categoryId` |
| `GET /operations/:id`, `PUT /operations/:id`, `DELETE /operations/:id` | `200` / `200` / `204`                        | [Opérations ponctuelles](one-off-operation-api.md)                                                            |
| `GET /events`, `POST /events`                                          | `200` liste / `201` création avec `Location` | `title`, `amount`, `currency`, `kind`, `startDate`, `recurrence`, `endDate?`                                  |
| `GET /events/:id`, `PUT /events/:id`, `DELETE /events/:id`             | `200` / `200` / `204`                        | Règle entière ; [invariants et ancrage mensuel](monthly-event-domain.md)                                      |
| `GET /event-occurrences`                                               | `200` liste                                  | `month` obligatoire ; occurrences calculées, aucune opération créée                                           |
| `GET /goals`, `POST /goals`                                            | `200` liste / `201` création avec `Location` | `title`, `targetAmount`, `currency`, `savedAmount?`, `monthlyContribution?`, `targetDate?`                    |
| `GET /goals/:id`, `PUT /goals/:id`, `DELETE /goals/:id`                | `200` / `200` / `204`                        | [Objectifs et prévision](financial-goals.md)                                                                  |

Les listes acceptent `limit` et `cursor` en plus des filtres déclarés. Les
corps opération/événement/objectif refusent les champs inconnus en `422`, dont
`ownerId`. `kind` vaut `DEPENSE` ou `ENTREE`. La réponse d'opération utilise
toutefois la clé **`type`**, pas `kind`. Une suppression `204` n'a aucun corps
JSON. La création d'une catégorie ne promet pas d'en-tête `Location`.

## Budget, décisions d'occurrence et agrégats

| Méthode et chemin                                | Succès                            | Paramètres et effet                                                                                 |
| ------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /budget-periods/:month/summary`             | `200`, `{data}`                   | `currency` obligatoire, au plus 31 points ; un mois passé est clôturé à la première lecture         |
| `GET /budget-periods/history`                    | `200`, `{data, meta}`             | `currency`, `limit?`, `cursor?` ; bilans clôturés                                                   |
| `GET /event-occurrences/pending`                 | `200`, `{data, meta}`             | `through?`, `limit?`, `cursor?` ; non résolues sur les 12 mois se terminant au mois de `through`    |
| `POST /event-occurrences/:eventId/:date/realize` | `201` ou `200` si rejeu identique | `categoryId` obligatoire, `title?`, `amount?`, `operationDate?` ; opération et résolution atomiques |
| `POST /event-occurrences/:eventId/:date/cancel`  | `201` ou `200` si rejeu identique | Pas de corps requis ; résolution avec `operation: null`                                             |
| `GET /analytics/operations`                      | `200`, `{data}`                   | `from`, `to`, `currency`, `groupBy` obligatoires ; `splitBy?`, `kind?`                              |

Lire [budget-projection-api.md](budget-projection-api.md) pour les corrections,
révisions, reports et conflits, et [analytics-api.md](analytics-api.md) pour les
bornes par regroupement. Un résumé ne transporte pas toutes les opérations.
L'agrégat analytics est borné par sa période, sans pagination `limit/cursor`.

## DTO publics et données à exclure

Les champs des DTO récents sont construits explicitement dans leurs
contrôleurs ; ne pas sérialiser l'objet Prisma ou domaine par propagation.

| DTO                   | Champs publics                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Catégorie             | `id`, `name`, `color`, `icon`                                                                                              |
| Opération             | `id`, `title`, `amount`, `currency`, `type`, `operationDate`, `categoryId`                                                 |
| Règle d'événement     | `id`, `title`, `amount`, `currency`, `kind`, `startDate`, `recurrence`, `endDate`                                          |
| Occurrence calculée   | Champs de la règle et `occurrenceDate` ; son `id` reste celui de la règle                                                  |
| Objectif              | `id`, `title`, `targetAmount`, `savedAmount`, `monthlyContribution`, `currency`, `targetDate`, `forecast`                  |
| Prévision d'objectif  | `referenceMonth`, `status`, `remainingAmount`, `contributionsNeeded`, `estimatedReachMonth`, `requiredMonthlyContribution` |
| Occurrence en attente | `eventId`, `occurrenceDate`, `title`, `amount`, `currency`, `kind`, `overdue`                                              |
| Décision d'occurrence | `eventId`, `occurrenceDate`, `status`, `title`, `amount`, `currency`, `kind`, `resolvedAt`, `operation`                    |

L'opération imbriquée d'une décision contient seulement `id`, `title`, `amount`,
`operationDate`, `categoryId`. Les synthèses/historiques exposent des totaux,
états et révisions explicités par leur
[contrôleur](../src/modules/budgetPeriods/presentation/BudgetPeriodController.ts)
et leur [contrat](budget-projection-api.md).

Les ressources personnelles n'exposent pas `ownerId`/`userId`, les identifiants
de migration/template, les secrets, les hachages ou les détails de curseur.
Les identifiants publics de ressource et de catégorie restent nécessaires.
L'exception administrative `GET /users` expose `id`, `firstname`, `lastname`,
`email`, `role`, `verified`, `created_at`, `updated_at` uniquement. Le profil
d'authentification et celui de renouvellement excluent mot de passe et jetons
de récupération ; ils conservent leurs sélections historiques respectives.

## Validation, autorisation et erreurs

Le [gestionnaire central](../src/middlewares/errorHandler.middleware.ts) produit :

```json
{
  "response": "error",
  "error": {
    "type": "Unauthorized",
    "path": "/v1/events",
    "statusCode": 401,
    "message": "The access token is not valid or is expired."
  }
}
```

`details` est facultatif : tableau `{field, message, rule}` pour certaines
validations, objet `{code}` pour une erreur métier. Ne pas supposer une forme
unique ni analyser les textes pour piloter l'interface. Utiliser le statut,
`type` et le `code` métier lorsqu'il est fourni.

| Statut | Contrat et portée                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `WrongParamsID` pour les identifiants des modules récents ; `IncompleteRequestBody` pour JSON mal formé et validation historique ; certains `PrismaError` historiques |
| `401`  | `Unauthorized` pour Bearer absent/invalide/expiré ; connexion refusée, session invalide ou récupération invalide selon le parcours                                    |
| `403`  | `AccessForbidden` pour la liste admin sans rôle ; `CorsOriginDenied` pour origine refusée ; `EmailAlreadyTaken` à l'inscription                                       |
| `404`  | `NotFound` pour route inconnue ou ressource récente absente/étrangère ; ne révèle pas son propriétaire                                                                |
| `409`  | `Conflict` : catégorie dupliquée/référencée, `OCCURRENCE_ALREADY_RESOLVED`, `PERIOD_CLOSED`, confirmation déjà utilisée                                               |
| `413`  | `PayloadTooLarge` : corps au-delà de `64kb` ou plus de 100 paramètres URL-encodés                                                                                     |
| `422`  | `ValidationFailed` : corps récent, invariants, query ou curseur invalides ; `FUTURE_PERIOD` pour synthèse future, `INVALID_CATEGORY_ICON` pour icône refusée          |
| `429`  | `TooManyRequests` sur familles d'authentification limitées, avec `Retry-After`                                                                                        |
| `500`  | Erreur inattendue assainie, `UnknownError` / `Unknown Error`, sans SQL ni stack dans la réponse                                                                       |
| `503`  | Readiness indisponible : corps minimal distinct de l'enveloppe d'erreur                                                                                               |

Les parseurs globaux et CORS peuvent rejeter avant l'authentification. Ensuite,
les routes métier privées authentifient avant validation de formulaire et
filtrent le propriétaire en persistance. Une ressource étrangère et une
ressource absente donnent le même `404` dans les modules récents.

La validation historique `Validator` ignore/supprime les propriétés inconnues ;
les validateurs récents les refusent. Envoyer seulement les champs déclarés.

## Pagination et compatibilité

Une collection paginée renvoie par exemple :

```json
{ "data": [], "meta": { "limit": 50, "hasNext": false, "nextCursor": null } }
```

`limit` est un entier de 1 à 100 (50 par défaut). Reprendre `nextCursor` sans
le décoder, avec les mêmes utilisateur, ressource et filtres. Curseur invalide,
altéré, invalidé par rotation du secret d'accès, repris pour un autre mois/compte
ou paramètre inconnu : `422`. Recommencer alors sans curseur. Il n'existe ni
`offset`, ni total garanti, ni instantané immuable d'une collection modifiée.
Les ordres et index sont détaillés dans [api-pagination.md](api-pagination.md).

L'OpenAPI est assemblé dans [swagger.def.ts](../src/utils/swagger.def.ts)
à partir des routes et schémas ; le JSON d'exemple statique n'est pas une
spécification générée à jour. Certaines annotations historiques (inscription,
récupération, confirmation) ne décrivent pas exactement les statuts ou
redirections exécutés. Ce guide signale ces écarts sans modifier l'OpenAPI ;
en cas d'évolution, réconcilier route, tests, schémas et documentation dans une
issue de contrat dédiée, avec analyse de compatibilité.

## Reproduction et traçabilité

Avec le serveur local configuré et lancé, ces lectures ne nécessitent aucun
compte et n'envoient aucun courriel :

```bash
curl -i http://localhost:4200/v1/
curl -i http://localhost:4200/health/live
curl -i http://localhost:4200/health/ready
curl -i http://localhost:4200/v1/events
```

Attendre successivement `200` JSON d'identification, `200` de liveness,
`200` ou `503` de readiness et `401` JSON sur la collection privée.
Pour les succès authentifiés, les suites injectent des identités ou créent des
comptes de test dans la base jetable : aucune clé ni donnée réelle n'est
nécessaire. Suivre [test-environment.md](test-environment.md).

La [matrice de caractérisation](api-characterization-tests.md) relie les cas aux
suites ; la [table d'architecture](architecture.md) relie les décisions aux
issues GitHub. Une évolution publique exige tests, schémas/docs, fragment et
stratégie de compatibilité. Le retour à l'ancienne application ne retire pas
les migrations ; voir [ci-cd.md](ci-cd.md) et la persistance concernée.
