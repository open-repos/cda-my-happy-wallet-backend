# Rapprochement prévu / réalisé (#139)

Contrat backend pour frontend #314 (parent #313). Toutes les routes ci-dessous
sont privées et préfixées par `/v1`. OpenAPI : tag `Reconciliation`.

## Décision financière et périmètre

Le suivi est **isolé** du moteur global, conformément à l'option de repli de
l'issue #139. Chaque lecture de rapprochement expose :

```json
{
  "integration": {
    "mode": "TRACKING_ONLY",
    "globalBudgetAdjusted": false,
    "warning": "GLOBAL_RAV_FORECAST_SAVINGS_UNCHANGED"
  }
}
```

Le frontend doit afficher « Suivi prévu/réalisé — non intégré au reste à vivre ».
Il ne doit pas remplacer RaV, prévision, report ou capacité d'épargne par les
totaux de ce module, ni soustraire à nouveau les enveloppes de ces indicateurs.
Le lien n'ajoute, ne modifie et ne supprime aucune opération réelle. Les
agrégats existants des opérations restent donc strictement identiques.

Le moteur historique applique `revenus fixes - charges personnelles mensualisées

- entrées réelles - dépenses réelles`, puis les événements non résolus et
  l'effort d'épargne. Une opération saisie pour payer une charge fixe est déjà
  comptée en plus du socle fixe. **Cette limite préexistante reste présente dans
  les routes globales**, même après rapprochement ; ce module ne prétend pas la
  corriger. Une intégration complète nécessiterait une décision propriétaire sur
  le socle, les mouvements quotidiens, les anciens snapshots et la propagation
  des corrections aux reports et aux trajectoires. Aucune de ces formules n'a été
  modifiée. Le bilan de rapprochement compte en revanche chaque paiement une fois.

Tableau préalable des cas et invariants :

| Cas                                                | API de suivi                                               | Moteur global conservé / risque                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Enveloppe variable 300, achats liés 223            | Réalisé 223, disponible 77, projeté 300                    | Les achats réels sont comptés comme avant ; enveloppe absente du socle                              |
| Enveloppe 300, achats liés 333                     | Réalisé/projeté 333, dépassement 33, jamais 633            | Aucun nouvel événement ou débit                                                                     |
| Charge mensuelle personnelle 800, paiement lié 820 | Payé 820, dépassement 20, projeté 820                      | Socle fixe + opération toujours distincts dans RaV existant ; ne pas utiliser comme bilan rapproché |
| Charge partagée 800 à 50 %                         | Prévu personnel 400 ; opération saisie de 400 = réglé      | Mensualisation existante inchangée ; pourcentage appliqué une fois au prévu                         |
| Charge annuelle 120 à 100 %                        | Non éligible : `NON_MONTHLY_WITHOUT_DUE_DATE`              | Coût mensuel de 10 conservé ; pas de faux dépassement de 110                                        |
| Revenu mensuel 2200, reçu lié 2180                 | Manquant 20, pas une dépense ; projeté 2200                | Revenu fixe et réel gardent leur sens dans le moteur actuel                                         |
| Opération non associée                             | Toujours réelle ; ajoutée une fois au projeté du suivi     | Jamais masquée des statistiques réelles                                                             |
| Confirmé non réalisé / potentiel                   | Ni paiement ni candidat                                    | Événement confirmé dans la prévision ; potentiel en Simulation seulement                            |
| Événement réalisé explicitement                    | Son opération réelle peut être choisie                     | Sa résolution existante empêche le double comptage de son événement                                 |
| Mois futur (jusqu'à +23)                           | Snapshot à la première lecture ; aucune opération inventée | Aucun `BudgetPeriod`, report ou objectif créé/modifié                                               |
| Mois passé / `BudgetPeriod.CLOSED`                 | Prévu matérialisé conservé, associations immuables         | Anciens bilans et corrections réelles existantes préservés                                          |

Les tests de non-régression vérifient l'invariance des mouvements, prévisions,
RaV et épargne avant/après association. Ils ne valident pas une nouvelle
formule globale.

## Bases de comparaison et arrondis

Tous les montants de sortie sont des chaînes à deux décimales, par devise, sans
conversion. Les entrées acceptent nombres ou chaînes décimales exactes de 0 à
99 999 999,99, au plus deux décimales ; aucun arrondi de saisie. Les sommes
utilisent des centimes entiers avec contrôle d'entier sûr ; les sommes SQL sont
`DECIMAL`. Les achats réels gardent leur montant positif existant.

Pour chaque occurrence :

- `planned` : budget personnel ; `actual` : somme des opérations liées ;
- `remaining = max(planned - actual, 0)` ; `overrun = max(actual - planned, 0)` ;
- `progress = actual / planned × 100`, arrondi à deux décimales (demi vers le
  haut), `null` si prévu nul, sans plafond à 100 % ;
- `projected = max(planned, actual)`, pour dépenses et revenus : l'hypothèse
  conserve le montant encore attendu, sans garantir qu'il arrivera.

Les revenus ajoutent `expected`, `received`, `missing`, `surplus` ; ne pas
présenter leur `overrun` comme une dépense. États : enveloppe `AVAILABLE`,
`REACHED`, `EXCEEDED` ; charge `DUE`, `PARTIAL`, `PAID`, `EXCEEDED` ; revenu
`EXPECTED`, `PARTIAL`, `RECEIVED`, `SURPLUS`. Prévu et réel nuls : `REACHED`,
`PAID` ou `RECEIVED`, taux `null`.

`referenceTotal` et `personalShare` conservent la référence de la source. Pour
une charge, `planned` utilise le calcul existant de part personnelle arrondie
au centime, demi vers le haut. **Les opérations réelles doivent représenter la
part personnelle réellement payée**, comme les autres opérations ponctuelles.
Le rapprochement ne remultiplie jamais leur montant par `personalShare`.
Un débit total de 800 lié à une prévision personnelle de 400 est donc bien un
réalisé de 800 : le serveur n'invente ni remboursement ni allocation.

La synthèse de suivi expose `actualIncome/Expense` sur toutes les opérations du
mois et de la devise, `unassociatedIncome/Expense`, `trackedPlannedIncome/Expense`
et `projectedIncome/Expense`. Projeté = somme des `max(prévu, réalisé lié)`
par occurrence + réel non associé, une seule fois. Son scope explicite est
`TRACKED_OCCURRENCES_AND_UNASSOCIATED_ACTUALS` : les charges non mensuelles,
événements, épargne et reports sont hors de cette synthèse. Ce n'est pas un solde.

## Routes et intégration Web

| Action                               | Route                                                         | Réponse                                                                              |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Lister les définitions               | `GET /budget-envelopes?limit=50&cursor=...`                   | `{data, meta}` ; inclut les archives                                                 |
| Définitions actives pour un mois     | `GET /budget-envelopes?month=2026-10`                         | Filtre actif + dates d'effet, pas un historique                                      |
| Créer une enveloppe                  | `POST /budget-envelopes`                                      | 201 `{data}`, `Location`                                                             |
| Lire / remplacer la définition       | `GET/PUT /budget-envelopes/:id`                               | 200 `{data}`                                                                         |
| Archiver                             | `DELETE /budget-envelopes/:id`                                | 204, idempotent, conservation de l'historique                                        |
| Occurrences d'un mois                | `GET /reconciliation/months/2026-10/occurrences?currency=EUR` | `{data, meta, integration, historyPolicy}`                                           |
| Synthèse du suivi                    | `GET /reconciliation/months/2026-10/summary?currency=EUR`     | `{data, integration}`                                                                |
| Lire une occurrence                  | `GET /reconciliation/occurrences/:id`                         | `{data, integration}`                                                                |
| Ajustement explicite du prévu ouvert | `PATCH /reconciliation/occurrences/:id`                       | `{planned:"320.00"}` → `{data, integration}`                                         |
| Paiements associés                   | `GET /reconciliation/occurrences/:id/operations`              | `{data, meta}`                                                                       |
| Paiements éligibles non associés     | Même route avec `unassociated=true`                           | Même mois/devise/sens ; catégorie libre                                              |
| Lire le lien courant                 | `GET /operations/:id/reconciliation`                          | `{data:{operationId,occurrenceId}, integration}` ; lien absent : `occurrenceId:null` |
| Associer, réaffecter, dissocier      | `PUT /operations/:id/reconciliation`                          | 204 ; voir comparaison ci-dessous                                                    |
| Suggestions par opération            | `GET /operations/:id/reconciliation-suggestions`              | `{data, meta, automatic:false, selectionRequired:true, ambiguous}`                   |
| Éligibilité des opérations fixes     | `GET /reconciliation/fixed-eligibility`                       | `{data, meta}` ; raison explicite pour chaque source                                 |

Toutes les collections suivent la pagination existante (`limit` 1..100, défaut
50 ; `meta.hasNext`, `meta.nextCursor`), tri ID croissant. Les curseurs sont
opaques et liés au propriétaire, à la ressource et à tous ses filtres. La
synthèse donne des totaux complets, jamais des sommes de la seule page visible.
Les paramètres répétés, inconnus et les champs propriétaires sont refusés.

Corps d'une définition mensuelle (les montants nuls sont autorisés) :

```json
{
  "title": "Courses",
  "amount": "300.00",
  "currency": "EUR",
  "categoryId": 12,
  "startMonth": "2026-10",
  "endMonth": null
}
```

`categoryId` est personnel et facultatif (`null` par défaut) ; une catégorie de
revenus fixes est refusée pour une enveloppe de dépenses. `endMonth` est inclusif.
La périodicité est toujours mensuelle dans ce MVP. Les IDs sont ceux renvoyés par
l'API, jamais ceux des modèles de catégories.

Une première lecture des occurrences crée les snapshots du mois courant ou
futur pour les enveloppes actives et les opérations fixes mensuelles. Répéter
la lecture ne les duplique ni ne les actualise. Aucun lien automatique, même si
une seule catégorie correspond. Deux enveloppes de même catégorie restent deux
candidats distincts. Choix explicite obligatoire dans tous les cas.

Exemple de paiement et réaffectation :

```json
{ "occurrenceId": 41, "expectedOccurrenceId": null }
```

Puis, pour le déplacer de 41 à 42 :

```json
{ "occurrenceId": 42, "expectedOccurrenceId": 41 }
```

Pour le dissocier de 42 :

```json
{ "occurrenceId": null, "expectedOccurrenceId": 42 }
```

`expectedOccurrenceId` est obligatoire, même à `null`. L'état courant doit
correspondre ou la commande renvoie 409 `ASSOCIATION_CONFLICT`. Un rejeu dont la
cible est déjà atteinte renvoie 204 sans écriture, y compris après clôture.
Un ancien rejeu après une autre réaffectation échoue si l'état attendu diffère.
Le client relit `GET /operations/:id/reconciliation` avant de proposer une nouvelle commande.
Une occurrence accepte plusieurs opérations ; une opération ne peut appartenir
qu'à une occurrence. La catégorie différente n'empêche pas un choix manuel.

## Historisation, modifications et clôture

Les occurrences sont **matérialisées et figées à la première lecture**, y
compris dans un mois futur. Modifier le titre, le budget, les dates ou la
catégorie d'une définition ne réécrit aucune occurrence existante. Une correction
ouverte du prévu se fait explicitement par PATCH de l'occurrence ; la référence
et le pourcentage d'origine restent visibles. La suppression d'une définition
via DELETE l'archive : elle ne produit plus de nouvelles occurrences, conserve
celles déjà matérialisées (même futures) et tous leurs paiements. Une archive
est terminale dans ce MVP. Pour arrêter un mois déjà matérialisé, ajuster
explicitement son prévu à zéro ; un réalisé éventuel reste visible.

Les sources fixes suivent la même règle : édition ou suppression par les routes
historiques conserve leurs snapshots existants ; les mois non matérialisés
utilisent la source courante. Le `fixedSourceId` historique est sans FK, comme
la référence d'événement des résolutions existantes. L'ID ne garantit donc pas
que la définition existe encore. La catégorie de l'occurrence est aussi une
référence historique ; la catégorie de définition reste protégée par une FK.

Un mois devient immuable dès qu'il est passé à Paris ou que son `BudgetPeriod`
est `CLOSED`. Pas de reconstruction d'un ancien prévu depuis les définitions
actuelles : un ancien mois jamais matérialisé renvoie une liste vide avec
`historyPolicy=MATERIALIZED_SNAPSHOTS_ONLY`. Les anciens snapshots `BudgetPeriod`
restent lisibles et inchangés. Les métriques des liens fermés sont stables,
car l'édition/suppression des opérations liées et leurs associations est bloquée.
Aucun endpoint de réouverture ni correction rétroactive de lien n'est ajouté.
Les corrections des opérations **non liées** gardent leur contrat historique,
y compris les recalculs explicites de bilans ; la synthèse du suivi relit ces
faits réels et n'est pas un nouveau snapshot de clôture du RaV.

Opération liée ouverte : titre, montant ou catégorie modifiables via l'API
existante ; métriques actualisées à la lecture suivante. Changer le mois, le
sens ou la devise exige de dissocier d'abord (`409 LINKED_OPERATION_INCOMPATIBLE`).
La supprimer retire son lien, jamais son occurrence. La même opération fermée
est protégée (`409 PERIOD_CLOSED`). Les créations et opérations non liées
conservent leurs règles préexistantes. La suppression authentifiée du compte
retire d'abord les liens, occurrences et enveloppes dans la transaction du
compte : elle ne dépend pas d'un ordre de cascades MySQL avec `RESTRICT`. Une
adresse de compte erronée ne retire aucune métadonnée.

## Erreurs et transactions

Authentification 401 ; ID de chemin mal formé 400 ; ressource absente/étrangère
404 sans fuite de propriétaire ; validation 422 ; conflits 409. Codes dans
`error.details.code` : `PERIOD_CLOSED`, `ASSOCIATION_CONFLICT`,
`ARCHIVED_ENVELOPE`, `LINKED_OPERATION_INCOMPATIBLE`, `RETRY_CONFLICT`,
`CURRENCY_MISMATCH`, `TYPE_MISMATCH`, `PERIOD_MISMATCH`, `INVALID_CATEGORY`,
`INVALID_REQUEST`, `MONTH_TOO_FAR`. Pagination : contrat `ValidationFailed`
existant. Les IDs positifs inconnus ne révèlent jamais de données tierces.

Toutes les mutations d'associations, la matérialisation, les définitions et
l'édition/suppression d'opérations utilisent une transaction et un verrou
propriétaire commun. Les périodes concernées sont verrouillées avant décision
d'ouverture. La contrainte primaire sur `operationId` garantit l'unicité ; les
FK composites interdisent les propriétaires différents jusque dans MySQL.
Réaffectation et contrôles sont atomiques, sans état intermédiaire sans lien.
Les deadlocks de transaction de rapprochement sont réessayés au plus deux fois,
puis renvoient un conflit explicite. Les agrégats de paiements utilisent une
requête par page, sans N+1 ni chargement de tous les paiements en mémoire.

## Migration, validation et contrat futur

`20261027120000_add_budget_reconciliation` crée `BudgetEnvelope`,
`ReconciliationOccurrence`, `ReconciliationLink`, leurs index et FK composites,
et l'index unique redondant `(id,userId)` des opérations pour ces FK. Aucun
montant historique, aucune ligne réelle ou période n'est modifié. Aucun backfill
ni reset. La migration précède le backend et n'est pas annulée par rollback.
Un ancien backend peut ignorer les tables, mais n'applique pas les protections
des opérations liées : ne pas revenir à cette version avec des liens actifs
sans procédure propriétaire préservant leur historique. Préférer un correctif
en avant ; ne pas supprimer les tables ou modifier une migration déployée.

Tests : `test:reconciliation-domain`, `test:reconciliation-api`,
`test:reconciliation-persistence`, `test:reconciliation-migration`. Ces quatre
tests sont appelés par les suites existantes de CI sans modifier les
workflows. Les tests SQL exigent `NODE_ENV=test` et MySQL jetable sur
`my-happy-wallet-mysql-test`, base `myhappywallet_test`.

Contrat futur proposé, non implémenté : une source périodique aurait une
règle d'échéance explicite (`nextDueDate`, `recurrenceAnchor`, fréquence), puis
des occurrences `dueDate`, `totalDue`, `personalDue` et une réserve/provision
mensuelle distincte. Le paiement de 120 annuels serait comparé à `personalDue`
à l'échéance, jamais à une provision de 10. L'allocation d'une provision à
plusieurs mois, les remboursements et leur effet sur RaV/reports exigent une
décision propriétaire séparée. Le MVP ne fait aucune conversion implicite.
