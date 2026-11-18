# Décisions de fin de mois (#184)

Le mois est éligible à partir du premier jour du mois suivant, selon la date
civile `Europe/Paris`. Sans réponse, le report complet existant reste appliqué.
Le client demande le mois précédent au démarrage ; aucune notification serveur
ni décision automatique ne déplace de fonds.

## Contrat

`GET /budget-periods/:month/decision?currency=EUR` retourne `{data}` : statut
`PENDING`, révision 0 et allocations vides en l'absence de décision ; sinon
`DECIDED` et la révision courante. Cette lecture peut matérialiser le bilan clos,
comme la lecture du résumé. Un mois courant ou futur renvoie 409
`PERIOD_NOT_CLOSED`. Le propriétaire provient uniquement de l'authentification.

`PUT` à la même adresse remplace intégralement la décision :

```json
{
  "expectedRevision": 0,
  "idempotencyKey": "octobre-2026-decision-001",
  "savings": [{ "accountId": 12, "amountMinorUnits": 10000 }],
  "coverage": [],
  "exceptionalIncomeMinorUnits": 0
}
```

Tous les montants sont des centimes entiers, de 0 à 9 999 999 999 ; une
allocation est strictement positive. Chaque tableau contient au plus 100
comptes distincts, triés par identifiant dans la réponse. Les cinq propriétés
sont obligatoires, les propriétés supplémentaires sont refusées. Les tableaux
sont bornés ; aucune nouvelle collection non bornée n'est exposée.

La réponse expose `month`, `currency`, `status`, `revision`, les allocations,
`savingsMinorUnits`, `coverageMinorUnits`, `exceptionalIncomeMinorUnits`,
`referenceResultMinorUnits`, `resultBeforeDecisionMinorUnits`, `carryMinorUnits`,
`requiresReview` et `correctionDeltaMinorUnits`. Aucun identifiant de décision,
propriétaire, empreinte ou reçu interne n'est exposé.

## Formule à valider par le propriétaire avant fusion

Le **résultat avant décision inclut le report entrant** : il s'agit du solde
réel disponible, pas du seul résultat isolé du mois.

```text
report suivant = résultat avant décision − épargne + prélèvements d'épargne + entrée exceptionnelle
résultat avant décision = solde réel actuel + épargne décidée − couverture décidée − entrée exceptionnelle décidée
```

Le registre d'épargne alimente déjà le calcul réel : aucune seconde soustraction
n'est ajoutée au moteur de report. Un résultat positif autorise uniquement
l'épargne, dans la limite du solde. Un résultat négatif autorise uniquement sa
couverture, dans la limite du déficit. Le reliquat est toujours reporté.

| Situation                              | Résultat avant décision | Épargne | Prélèvement | Exceptionnel | Report |
| -------------------------------------- | ----------------------: | ------: | ----------: | -----------: | -----: |
| Sans réponse                           |                   150 € |     0 € |         0 € |          0 € |  150 € |
| Partage positif                        |                   150 € |   100 € |         0 € |          0 € |   50 € |
| Dépense oubliée de 30 € après décision |                   120 € |   100 € |         0 € |          0 € |   20 € |
| Déficit partiellement couvert          |                  −150 € |     0 € |        50 € |         70 € |  −30 € |

Une correction d'opération conserve les allocations et les soldes d'épargne.
L'écart est absorbé par le report, même s'il devient négatif. La lecture expose
`requiresReview=true` et l'écart signé par rapport au résultat de référence de
la dernière décision. Le client doit avertir l'utilisateur. Une nouvelle décision
explicite enregistre une nouvelle référence et acquitte cet avertissement.

## Atomicité, révisions et erreurs

Une transaction `ReadCommitted` verrouille d'abord la ligne utilisateur, comme
les virements existants. Elle valide tous les comptes, écrit la décision, les
mouvements différentiels et les soldes, recalcule les bilans/report suivants,
puis écrit un reçu durable. Tout échec annule l'ensemble. Le client doit relire
après `REVISION_CONFLICT` ; deux révisions concurrentes ne peuvent pas gagner.

Les résumés et prévisions lisent également le budget/report et la décision sous
le même verrou propriétaire, y compris lorsque leur dépôt partage déjà une
transaction. Une révision concurrente attend la fin de cette lecture : elle ne
peut pas mélanger un ancien report avec les nouvelles allocations.

Une clé d'idempotence est sensible à la casse, propre au propriétaire et commune
aux mois/devises de ce propriétaire. Même clé et même requête normalisée :
réponse originale exacte, y compris après une correction ou une révision.
Même clé avec contenu différent : `IDEMPOTENCY_CONFLICT`. Une réponse rejouée
est historique : faire ensuite un GET pour afficher l'état courant.

Les virements sont datés du dernier jour du mois couvert. Une réduction crée
une compensation, jamais une suppression ni une modification de registre.
L'historique paginé existant expose `monthEndRevision` et `isCompensation` pour
ces mouvements. Le motif d'origine reste `MONTH_END` ou `NEGATIVE_COVERAGE` ;
une compensation inverse son sens. Cette exception est réservée au service
interne. Le transfert manuel refuse le préfixe de clé `month-end:`.

Les comptes étrangers sont indistinguables des comptes absents (404
`NOT_FOUND`). Devise différente, nouvelle allocation sur compte archivé, fonds
d'épargne insuffisants ou plafond dépassé : 409 avec code respectif
`CURRENCY_MISMATCH`, `ACCOUNT_ARCHIVED`, `INSUFFICIENT_SAVINGS`, `BALANCE_LIMIT`.
Un compte archivé peut conserver son allocation ou la réduire. Une annulation
nécessite les fonds nécessaires à sa compensation. Les entrées invalides
renvoient 422 `INVALID_MONTH`, `INVALID_CURRENCY`, `INVALID_DECISION`,
`INVALID_ALLOCATION` ou `ALLOCATION_EXCEEDS_RESULT` dans `error.details.code`.

## Entrée exceptionnelle et lectures financières

L'entrée exceptionnelle est portée par la décision du mois couvert, datée de
son dernier jour. Une révision remplace son montant actif ; les reçus gardent
l'audit des montants précédents. Elle contribue aux entrées réelles et au report,
sans modifier les revenus fixes ni créer d'opération ponctuelle modifiable.

Les Analyses ajoutent une catégorie système virtuelle, réservée, d'identifiant
`0`, nommée **Entrée exceptionnelle**, sans couleur. Les catégories utilisateur
gardent leurs identifiants positifs ; aucun libellé utilisateur n'est renommé.
Toutes les dimensions temporelles, catégorie et sens, ainsi que leurs découpages,
incluent ces entrées. Un filtre `DEPENSE` les exclut. Les virements d'épargne
restent exclus des Analyses. Les deux agrégations filtrent propriétaire, devise
et dates en base et utilisent leurs index bornés.

Le résumé d'un mois décidé ajoute `monthEndDecision`. La prévision ajoute
`carryDecision` pour le mois précédant le mois courant, même si la fenêtre
demandée commence plus tard. Ces champs sont absents sans décision. Les anciens
montants décimaux restent inchangés ; ces objets utilisent les centimes entiers.

L'historique paginé du compte courant inclut la nouvelle source
`EXCEPTIONAL_INCOME`, de sens `ENTREE`, sans `accountId`. Les curseurs partagés
précédents restent valides. Le Web #396 et le mobile #397 doivent accepter cette
source, les métadonnées de compensation et la catégorie système 0 avant
d'exposer ces décisions. Les comptes et le registre manuel existants restent
utilisables pendant la préparation de ces interfaces.

## Migration et retour arrière

`20261108211500_add_month_end_decisions` est additive : deux tables, trois
colonnes de registre avec valeurs par défaut compatibles et des contraintes
supplémentaires. Aucune donnée existante n'est convertie. Une nouvelle contrainte
étend le sens des motifs uniquement aux compensations identifiées. La migration
est appliquée avant la sélection du nouveau conteneur ; un retour au binaire
précédent ne l'annule pas.

MySQL interdit un CHECK sur une colonne participant à une clé étrangère avec
action CASCADE ([documentation MySQL](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html)).
Le CHECK exige donc la révision positive et le motif/sens de compensation ;
l'application fournit toujours ensemble `monthEndDecisionId` et
`monthEndRevision`. Les routes publiques refusent ces propriétés. La FK composite
vérifie le propriétaire lorsqu'un identifiant de décision est présent. La base
seule n'interdit pas un identifiant NULL accompagné d'une révision positive ;
aucun chemin d'écriture applicatif ne produit cet état. Le test de migration
vérifie la révision obligatoire, sans prétendre vérifier cette implication SQL.

Avant toute décision, un retour au binaire précédent laisse le schéma additionnel
en place. Après des décisions, surtout avec une entrée exceptionnelle, revenir
au vieux moteur produirait des reports/Analyses incomplets : privilégier un
correctif en avant, suspendre les écritures si nécessaire et conserver données
et reçus. Ne pas supprimer les tables/colonnes ni effacer les mouvements de
compensation. Un retour fonctionnel exige de compenser explicitement les
allocations sous le nouveau moteur, vérifier les reports et garder une sauvegarde
restaurable ; ce n'est pas un rollback SQL automatique.

Les répétitions de migration utilisent uniquement la base jetable protégée.
Le helper `test/modules/monthEnd/migrationFixture.ts` remet le schéma précédent
en place exclusivement pour ces tests ; il refuse des décisions encore présentes.

## Validation

`test:month-end-domain` vérifie la formule, les centimes, les limites et les
deltas. `test:month-end-api` vérifie sur MySQL jetable l'authentification,
l'isolation, les révisions concurrentes, l'idempotence durable, les comptes,
les reports, corrections, résumés, prévisions, Analyses et la pagination.
Il force aussi une révision entre le calcul du budget/report et la lecture de
la décision pour les deux parcours résumé/prévision : l'écrivain doit attendre
et aucun faux avertissement ne doit apparaître.
`test:month-end-migration` rejoue l'extension sur un registre préexistant et
vérifie les centimes conservés, les contraintes et les clés de propriétaire.
