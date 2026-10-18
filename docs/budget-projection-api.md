# API des projections budgétaires

## Statut

- Work Item : `M05-04`
- Domaine : `docs/daily-budget-domain.md`,
  `docs/event-occurrence-resolutions.md`
- Consommateurs : Web `M05-05`, mobile `M05-06`

Toutes les routes sont préfixées par `/v1`, exigent le jeton d'accès et
filtrent le propriétaire authentifié. Les montants sont des chaînes décimales
à deux chiffres; les dates métier sont des dates civiles `YYYY-MM-DD`. Aucun
DTO n'expose d'identifiant propriétaire. La date du jour vient de l'horloge
`Europe/Paris`.

## Synthèse mensuelle

`GET /budget-periods/{month}/summary?currency=EUR`

Renvoie le socle, le report (`carryIn`, `carryFromMonth`), les totaux fixes et
réels, le résultat propre au mois (`monthResult`), le reste réel, les jours
restants,
le disponible réel par jour, `unresolvedEvents` et au plus 31 points
journaliers. Pour le mois courant, `forecast` contient les entrées et dépenses
planifiées, l'épargne des objectifs, le reste prévisionnel, le disponible
prudent par jour et les compteurs `unresolvedCount` et `overdueCount`; chaque
jour porte aussi `plannedIncome`, `plannedExpense`, `plannedCount` et
`forecastRemaining`.

Un mois passé est clôturé à la première lecture et renvoie `forecast: null`
avec des champs prévisionnels journaliers à `null`. Un mois futur est refusé
en `422` avec `code: FUTURE_PERIOD`. Le résumé ne transporte aucune opération.

## Historique

`GET /budget-periods/history?currency=EUR&limit=&cursor=`

Bilans clôturés du plus récent au plus ancien, paginés par curseur
`(mois, id)` lié au propriétaire et à la devise. Chaque élément donne socle,
report entrant, totaux réels, résultat du mois, reste réel, `balanceStatus`,
`unresolvedEvents` et `closedAt`.

## Corrections d'un mois clôturé

`POST`, `PUT` et `DELETE /operations` restent acceptés pour une date d'un mois
passé. Le backend recalcule alors le bilan clôturé de ce mois, puis le report
de chaque mois suivant jusqu'au mois courant. La synthèse et l'historique
exposent `revision` et `correctedAt` : un bilan corrigé a un `correctedAt` non
nul, que le frontend doit signaler (« Bilan corrigé le … »). Une écriture
concurrente du même bilan est rejouée jusqu'à cinq fois, après une attente
aléatoire et croissante (5 à 25 ms, doublée à chaque tentative, au plus
200 ms) qui désynchronise les écrivains. Après cinq conflits, la requête
renvoie une erreur serveur alors que l'opération est déjà enregistrée, et la
prochaine correction d'opération de ce mois rétablit la chaîne.

## Lecture du report

`realRemaining = carryIn + monthResult`. `carryFromMonth` vaut le mois
précédent dont le reste est reporté, ou `null` au premier mois d'activité de
la devise et avant. `balanceStatus` porte sur le reste réel, report compris;
`monthResult` permet de montrer si le mois lui-même était excédentaire. Le
frontend doit afficher le report sur une ligne nommée, par exemple « Report de
septembre : −120,00 € », jamais fondu dans le socle.

## Opérations filtrées

`GET /operations?from=&to=&currency=&limit=&cursor=`

Les trois filtres sont facultatifs et rétrocompatibles. `from` et `to` sont
inclusifs; une journée utilise la même date. L'ordre reste du plus récent au
plus ancien puis par identifiant décroissant. Les filtres font partie du
contexte du curseur : réutiliser un curseur avec d'autres filtres renvoie
`422`.

## File à traiter

`GET /event-occurrences/pending?through=&limit=&cursor=`

Occurrences planifiées sans décision, triées par date puis règle, jusqu'à
`through` inclus (aujourd'hui par défaut). La file couvre le mois de `through`
et les 11 mois précédents : une occurrence plus ancienne reste non résolue mais
n'est plus proposée. Chaque élément indique `overdue` si sa date précède
aujourd'hui.

## Commandes d'occurrence

`POST /event-occurrences/{eventId}/{date}/realize`

Corps : `categoryId` obligatoire, `title`, `amount` et `operationDate`
facultatifs (valeurs de l'occurrence par défaut).

`POST /event-occurrences/{eventId}/{date}/cancel`

| Statut | Signification                                                   |
| ------ | --------------------------------------------------------------- |
| `201`  | Décision enregistrée                                            |
| `200`  | Rejeu d'une commande identique déjà réussie                     |
| `400`  | Identifiant de règle invalide                                   |
| `404`  | Règle, occurrence ou catégorie introuvable pour ce propriétaire |
| `409`  | `OCCURRENCE_ALREADY_RESOLVED` ou `PERIOD_CLOSED`                |
| `422`  | Corps ou date invalide                                          |

La réponse décrit la décision, son instantané et l'opération liée
(`operation: null` pour une annulation).

## Compatibilité

Aucune migration. `GET /operations` sans filtre conserve son contrat et ses
curseurs. Le retour arrière consiste à redéployer la version précédente.
