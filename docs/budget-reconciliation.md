# Enveloppes mensuelles, solde et analyse (#139)

Contrat backend pour frontend #314, parent #313. Toutes les routes sont privées,
préfixées par `/v1`. La clarification propriétaire du 28 octobre remplace le
périmètre initial : **seules les charges mensuelles explicitement marquées comme
enveloppes peuvent recevoir des opérations**. Revenus, charges ordinaires et
charges non mensuelles gardent leur traitement existant. Aucune association
par simple catégorie. Aucun changement frontend dans ce dépôt.

## Parcours et modèle unique

Dans le formulaire de charge existant :

```json
{
  "titre": "Alimentation",
  "montant": 300,
  "devise": "EUR",
  "periodicite": "MENSUELLE",
  "pourcentagePersonnel": 100,
  "categoryId": 12,
  "isBudgetEnvelope": true
}
```

`isBudgetEnvelope` vaut **false par défaut** pour toutes les anciennes charges
et les nouvelles créations sans choix explicite. Omission sur PUT : conserver.
Le flag est refusé pour les revenus ; `true` exige une charge mensuelle.
Les GET/POST de charges exposent ce booléen. La catégorie est indépendante du
mode de suivi. Les montants des paiements représentent la part personnelle ;
le pourcentage n'est appliqué qu'une fois au montant prévu.

Une enveloppe est une `OperationFixe` marquée, pas une seconde définition à
additionner à la charge. Les routes `/budget-envelopes` restent des alias de
compatibilité : elles créent/lisent/modifient une charge mensuelle marquée.
Leur ID est celui de la charge. Aucun objet `BudgetEnvelope` indépendant n'est
créé. Cette ancienne table reste en place pour respecter la migration publiée.

À la première lecture d'un mois courant/futur, les charges marquées produisent
une occurrence `sourceType=ENVELOPE`, `sourceId=idOperationFixe`, une seule fois
par source/mois. Une occurrence contient le prévu personnel, le total de
référence, la participation et la catégorie. Une ancienne période jamais suivie
n'est pas reconstruite depuis les définitions d'aujourd'hui.

## Saisie depuis calendrier ou opérations

Les deux formulaires Web doivent utiliser le même contrat POST/PUT `/operations` :

```json
{
  "title": "Courses du samedi",
  "amount": "85.00",
  "currency": "EUR",
  "kind": "DEPENSE",
  "operationDate": "2026-10-10",
  "categoryId": 12,
  "reconciliation": {
    "occurrenceId": 41,
    "expectedOccurrenceId": null
  }
}
```

Le calendrier fournit sa date sélectionnée. Le champ « Rattacher à une enveloppe »
charge les occurrences du mois et de la devise ; aucune charge ordinaire ni
entrée fixe n'est proposée. Une catégorie peut suggérer un choix, jamais le
confirmer automatiquement, y compris si un seul candidat correspond.

L'opération et son lien sont enregistrés dans **une transaction** : en cas de
période, devise, type, propriétaire ou association incompatible, tout est annulé.
Aucune opération orpheline n'est créée à la suite d'un échec de rattachement.
Sur PUT, omettre `reconciliation` conserve le lien ; fournir un autre ID
réaffecte ; `occurrenceId:null` dissocie. `expectedOccurrenceId` est toujours
obligatoire dans cet objet ; POST exige `null`. Un PUT normal peut modifier
montant/titre/catégorie ; changer mois/devise/sens exige une dissociation ou une
réaffectation explicite compatible dans la même transaction.

Les anciennes réponses d'opérations restent inchangées. Lire au besoin
`GET /operations/:id/reconciliation` pour préparer une réaffectation.
Les POST ordinaires conservent leur contrat existant : aucun mécanisme général
de rejeu d'un POST n'est ajouté. Le frontend empêche le double clic de création.

## Calcul validé : réserve ouverte, réalisé à la clôture

Exemple sans report, autres opérations ou épargne : revenus fixes 2 000 €, loyer
ordinaire 800 €, enveloppe Alimentation 300 €.

| Situation                       | Dépenses Alimentation retenues                      | Solde mensuel |
| ------------------------------- | --------------------------------------------------- | ------------- |
| Aucun paiement rattaché         | 300 € réservés                                      | 900 €         |
| 223 € rattachés pendant le mois | 300 € réservés                                      | 900 €         |
| 400 € rattachés pendant le mois | 400 €, dont 100 € supplémentaires                   | 800 €         |
| Clôture avec 223 € rattachés    | 223 €, libération des 77 € inutilisés               | 977 €         |
| Clôture avec 400 € rattachés    | 400 €                                               | 800 €         |
| Clôture sans paiement rattaché  | Prévision de 300 € conservée faute de réalisé connu | 900 €         |

Les statistiques réelles gardent tous les paiements bruts : 400 € reste une
dépense de 400 €, jamais une opération artificiellement réduite à 100 €.
Le moteur expose un ajustement signé distinct :

```text
résultat du mois = socle fixe + entrées réelles - dépenses réelles
                  + reconciliationAdjustment
solde = résultat du mois + report entrant
```

Pour chaque enveloppe ouverte, l'ajustement compense la partie déjà couverte
par son prévu : `min(prévu personnel, somme réelle liée)`. Les paiements sont
alloués chronologiquement pour les points journaliers. À la clôture, si au moins
un paiement est lié, toute la prévision de cette enveloppe est remplacée par le
réalisé ; la libération éventuelle intervient le dernier jour du mois. Une
opération non liée reste déduite une fois, sans correction implicite.
Les enveloppes font déjà partie du socle fixe : aucune seconde réserve n'est
ajoutée au prévisionnel ou à la capacité d'épargne.

Les routes de synthèse, prévisions multi-mois, Simulation, capacité et
trajectoires d'épargne utilisent le même ajustement. Les événements confirmés
non réalisés et les potentiels restent séparés des paiements ; une réalisation
explicite garde son mécanisme existant. Les règles des objectifs et de leur
réservation restent inchangées. Une opération déjà rattachée à une enveloppe
d’un mois futur participe à sa projection une seule fois ; le traitement
existant des opérations futures non rattachées est conservé.

Le champ monétaire optionnel `reconciliationAdjustment` apparaît dans les
synthèses et prévisions concernées. L'ancien RaV sans mois reste un indicateur
du socle configuré, pas un relevé bancaire ; pour le solde final utiliser
`/budget-periods/:month/summary`, et non la table historique arrondie en euros.

L'intégration est annoncée par :

```json
{
  "integration": {
    "mode": "INTEGRATED",
    "globalBudgetAdjusted": true,
    "policy": "OPEN_RESERVED_CLOSED_MATCHED_ACTUAL"
  }
}
```

Montants en centimes entiers/Decimal, sortie en chaînes à deux décimales,
contrôle des entiers sûrs, pas de conversion de devises. Taux arrondis demi
vers le haut, `progress=null` si prévu nul. Les champs de suivi conservent
`planned`, `actual`, `remaining`, `overrun`, `progress`, `projected` ; ce dernier
reste l'hypothèse de réserve `max(prévu,réalisé)` et **ne remplace pas** le solde
clôturé. Les états d'enveloppe sont `AVAILABLE`, `REACHED`, `EXCEEDED`.

## Préparer le mois suivant sans réécrire le passé

Le PUT habituel d'une charge ou d'un revenu accepte un mois d'effet :

```json
{
  "titre": "Alimentation",
  "montant": 350,
  "devise": "EUR",
  "isBudgetEnvelope": true,
  "effectiveMonth": "2026-11"
}
```

Utiliser le même champ pour un revenu, sans `isBudgetEnvelope`. La date doit
être le mois courant ou l'un des 23 suivants. Sans date, l'édition conserve sa
portée actuelle ; pour une définition déjà versionnée ou une enveloppe, une
version du mois courant est créée. Aucun effet rétroactif autorisé.

Une version garde titre, montant, devise, participation, périodicité, catégorie
et mode de suivi. La première modification datée conserve la définition
précédente comme référence de compatibilité ; ce n'est pas une reconstitution
des anciens budgets réels. La lecture choisit la dernière version applicable.

- Les GET historiques de définitions affichent la version applicable aujourd'hui.
- `GET /operations-fixes/months/2026-11` affiche les valeurs prévues pour novembre,
  avec pagination, avant leur entrée en vigueur.
- Les prévisions utilisent ces versions dans chaque mois, y compris les mois
  intermédiaires et les trajectoires d'épargne.
- Une modification datée met à jour les occurrences **ouvertes** à partir de ce
  mois, en respectant les versions ultérieures déjà programmées. Un snapshot
  futur déjà consulté ne bloque donc pas un changement explicite de budget.
- Les mois précédents et les bilans clôturés restent inchangés. L'ajustement
  financier est figé à la clôture ; les corrections d'opérations non liées
  peuvent recalculer les reports en conservant cet ajustement.

Une clôture relit ses paiements sous le verrou propriétaire commun à la saisie
et au rattachement, avant d'enregistrer ses totaux. Après clôture, les liens et
opérations liées ne sont plus modifiables. Aucun endpoint de réouverture ajouté.
Changer/désactiver/supprimer une enveloppe avec des paiements ouverts
incompatibles est refusé (`ENVELOPE_IN_USE`) ; préparer plutôt une modification
à partir d'un mois sans paiements liés. Les snapshots passés survivent à la
suppression de la définition.

## Accueil et Analyse : contrat Web

| Besoin                                     | Route                                                          |
| ------------------------------------------ | -------------------------------------------------------------- |
| Toutes les enveloppes du mois courant      | `GET /envelope-overview?currency=EUR`                          |
| Choisir un mois                            | `GET /envelope-overview?month=2026-10&currency=EUR`            |
| Afficher l'année                           | `GET /envelope-overview?year=2026&currency=EUR`                |
| Moyennes par catégorie sur 3, 6 ou 12 mois | `GET /envelope-analytics?from=2026-01&to=2026-12&currency=EUR` |
| Prévisions et métriques d'un mois          | `GET /reconciliation/months/2026-10/occurrences?currency=EUR`  |
| Totaux du seul suivi                       | `GET /reconciliation/months/2026-10/summary?currency=EUR`      |
| Tous les paiements d'une enveloppe         | `GET /reconciliation/occurrences/:id/operations`               |
| Paiements éligibles non liés               | Même route, `unassociated=true`                                |
| Lire / changer un lien                     | `GET/PUT /operations/:id/reconciliation`                       |
| Suggestions explicites                     | `GET /operations/:id/reconciliation-suggestions`               |
| Raisons d'inéligibilité des fixes          | `GET /reconciliation/fixed-eligibility`                        |

Accueil recommandé : cartes compactes « Alimentation · 400 / 300 € · +100 € »,
barre de progression, accès « Voir les dépenses » ouvrant la liste complète.
Analyse : même vue avec sélecteur mois/année et comparaison prévu/réalisé.
Les deux écrans utilisent les mêmes données, sans recalcul financier côté Web.
La vue renvoie chaque enveloppe avec ses mois observés, métriques, nombre de
paiements, aperçu des trois dernières opérations et chemin de liste paginée.

Les moyennes par enveloppe et par catégorie exposent :

- `meanActual`, dépense réelle mensuelle moyenne ;
- `meanPlanned`, budget moyen et `meanVariance`, écart moyen signé ;
- `exceededMonths`, `overrunRate` et `meanOverrun` (dépassements positifs moyens) ;
- `sampleMonths`, nombre de mois utilisés, et exclusions explicites.

Le mois courant et les mois futurs sont exclus. Un ancien mois sans opérations
rattachées n'est pas traité comme un zéro : il est exclu. Pour une catégorie
contenant plusieurs enveloppes, un mois n'est inclus que si chacune a des
opérations liées. Une vraie dépense nulle sans paiement ne peut pas encore être
confirmée explicitement : elle reste exclue. Ces chiffres décrivent les
paiements **rattachés**, pas une garantie d'exhaustivité bancaire.

La réponse porte `historyPolicy=OBSERVED_ONLY` : les mois historiques absents ne
sont pas inventés. Aucun relevé ancien à zéro ne sera créé pour remplir un
graphique annuel. Les catégories et devises sont séparées ; catégorie absente :
`category:null`, groupe technique ID 0. Pour l'affichage, libellé « Sans catégorie ».
Toutes les collections acceptent `limit` 1..100 (défaut 50), curseur opaque lié au
propriétaire, à la ressource et aux filtres. Pour les totaux complets du budget,
utiliser la synthèse dédiée, pas la somme d'une page.

## Erreurs, migrations et revue

401 sans authentification ; 404 pour ressource absente ou étrangère ; 400 pour
ID de chemin invalide ; 422 pour validation/incompatibilité ; 409 pour conflit.
Codes : `NOT_BUDGET_ENVELOPE`, `INVALID_BUDGET_ENVELOPE`, `INCOME_NOT_ELIGIBLE`,
`NON_MONTHLY_WITHOUT_DUE_DATE`, `INVALID_EFFECTIVE_MONTH`, `ENVELOPE_IN_USE`,
`PERIOD_CLOSED`, `ASSOCIATION_CONFLICT`, `CURRENCY_MISMATCH`, `TYPE_MISMATCH`,
`PERIOD_MISMATCH`, `LINKED_OPERATION_INCOMPATIBLE`, `INVALID_CATEGORY`.
Le lien est unique par opération, plusieurs opérations peuvent partager une
occurrence. Le propriétaire est imposé par le jeton et les FK composites.
La suppression du compte retire les métadonnées et définitions dans leur ordre
de dépendance. Aucun accès ou changement de données de production.

Migrations additives immuables :

1. `20261027120000_add_budget_reconciliation` : tables et index initiaux.
2. `20261028090000_integrate_reconciliation_budget` : ajustement figé de bilan,
   défaut 0 pour préserver les anciens bilans.
3. `20261028100000_fixed_envelope_versions` : opt-in faux par défaut, dates de
   vie de l'enveloppe et versions datées ; aucun backfill de montants existants.

Les migrations précèdent le backend et ne sont pas annulées avec l'application.
Après usage des liens/versions, un ancien backend ne connaîtrait ni les gardes
ni les dates d'effet : préférer un correctif compatible ; ne pas revenir
silencieusement à une version ignorant ces règles ni supprimer les tables.
Les échéances réelles non mensuelles et leur rapprochement restent hors scope.

Tests : `test:reconciliation-domain`, `test:reconciliation-api`,
`test:reconciliation-persistence`, `test:reconciliation-migration`, branchés
sur les suites existantes sans modifier les workflows. Les tests SQL refusent
toute base autre que la MySQL jetable gardée. Revue propriétaire requise pour
le contrat, les calculs validés et les migrations. Ne pas fusionner ni déployer.
