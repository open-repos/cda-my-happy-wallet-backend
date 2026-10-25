# Simulation des trajectoires d’épargne

Contrat additif : `POST /v1/savings-capacity/trajectories`. Le POST porte des
hypothèses sans les enregistrer. Les GET existants restent inchangés.
Authentification et erreurs suivent les contrats existants (401, 404, 422).

```json
{
  "currency": "EUR",
  "scenario": "standard",
  "months": 24,
  "selectedGoalId": 1,
  "currentRemainingVariableExpense": "100.00",
  "futureAdditionalVariableExpense": "700.00",
  "monthlySafetyMargin": "100.00"
}
```

Tous les champs sont obligatoires, sauf scenario (standard par défaut).
`months` inclut le mois courant (1–24), donc au plus 23 versements futurs.
Les hypothèses sont des chaînes décimales positives ou nulles, au plus
99 999 999,99, deux décimales obligatoires. Les champs inconnus sont refusés.
Le mois et la date de référence sont déterminés par l’horloge civile serveur.
L’objectif doit appartenir au demandeur et à la devise ; sinon 404 identique.

## Définitions et allocation

- **Capacité maximale théorique** : budget connu, engagements existants et
  reports compris, sans complément variable ni marge. Le versement possible
  au sélectionné inclut son versement prévu ; le supplément est distinct.
- **Épargne raisonnable estimée** : même budget, après complément variable et
  marge mensuelle non allouée. L’enveloppe future est **supplémentaire** aux
  événements déjà prévus ; elle ne doit pas représenter une seconde fois ces
  dépenses. Aucune détection via catégorie, aucun prorata implicite.
- Le mois courant conserve les calculs serveur réel + prévisions non résolues
  et les réservations de tous les objectifs. Seul le complément **restant**
  est soustrait dans reasonable. La marge vaut aussi pour le mois courant.
  Aucun versement du mois courant ne s’ajoute au montant déclaré.
- Le solde positif courant est protégé dans toutes les projections : aucune
  hypothèse ne permet de savoir s’il contient l’épargne déclarée. Il n’est
  pas considéré comme une nouvelle ressource à affecter. Un solde négatif
  reste une dette à résorber. `protectedBalance` le rend explicite.
- Les versements des autres objectifs restent réservés chaque mois. Seul le
  sélectionné reçoit le supplément. Les réservations initiales sont gelées
  sur l’horizon, même après atteinte, comme le prévisionnel existant ; elles
  ne sont jamais réaffectées automatiquement. La courbe de chaque objectif
  plafonne à sa cible, sans réduire un montant déclaré déjà supérieur.
- La marge est conservée en compte et protégée de nouveau chaque mois,
  elle ne peut pas être dépensée à nouveau comme supplément le mois suivant.
- Les courbes sont des **versements projetés**, pas un historique réel.
  Un budget déficitaire rend la date non finançable tant que les arriérés et
  la marge ne sont pas couverts : `estimatedReachMonth` reste null avec
  `reachReason=BUDGET_DEFICIT`. Une date redevient estimable au premier mois
  où la cible ET la couverture cumulée sont atteintes. Les versements réservés et
  les déficits restent visibles ; aucune priorité cachée ne finance un
  objectif aux dépens des autres. `scheduledReachMonth` ne doit pas être
  présenté comme une date finançable.

## Réponse et cohérence

`data` contient référence, devise/scénario, hypothèses normalisées, objectif
sélectionné et liste complète des objectifs de la devise avec déclaré,
cible, restant, versement prévu, échéance et forecast existant. Aucune
conversion ni nouveau statut d’événement ou de soutenabilité.
`projections.planned`, `.maximum` et `.reasonable` sont trois comparaisons
financières, indépendantes du scénario API standard/simulation.

Chaque projection expose `current` (reste serveur, réservations, complément,
marge, reste sous hypothèses, solde protégé), `points` (premier point =
montant déclaré du sélectionné au mois courant), `months` et l’estimation.
Chaque mois futur expose flux connu avant objectifs, report entrant,
complément, marge, capacité disponible avant objectifs (hors solde protégé), réservations de tous les
objectifs, supplément libre signé, supplément affecté, versement total du
sélectionné, solde sortant, solde protégé et allocations de chaque objectif
(réservation, versement projeté plafonné, cumul projeté). `fundable` indique
si engagements et marge sont financés cumulativement sur ce mois. Chaque
point futur porte aussi `fundable` : une courbe de versements projetés ne
doit jamais présenter un point non finançable comme de l’épargne acquise.
Le premier point déclaré reste toujours connu, indépendamment du budget.

`reachReason` : `REACHED`, `PROJECTED`, `NO_CONTRIBUTION`, `OUTSIDE_HORIZON`
ou `BUDGET_DEFICIT`. Une échéance absente reste null ; aucun jour estimé.
`scheduledReachMonth` est le mois nominal de franchissement dans la fenêtre,
`estimatedReachMonth` seulement s’il est finançable. Aucune extrapolation
au-delà des données budgétaires disponibles.

Les montants sont des chaînes décimales signées ; opérations en centimes
entiers sûrs et rejet de débordement. Pas de mélange avec les soldes cumulés
pour fabriquer un revenu mensuel.

L’adaptateur Prisma exécute la maintenance d’expiration existante avant une
transaction de lecture RepeatableRead. Les objectifs, données réelles,
prévisions et reports proviennent de ce même instantané. Aucun objectif,
événement, opération ou période n’est modifié par la simulation. La réponse
n’est pas un engagement de disponibilité ultérieure : chaque requête recalcule.
La première version ne suggère pas d’enveloppe historique ; cette analyse est
un chantier distinct nécessitant des périodes complètes et une couverture fiable.

## Exemple de référence

Au 25 octobre 2026 : cible 6 000 €, déclaré 1 800 €, versement 350 €,
échéance mai 2027, autre projet 150 €/mois, flux futur connu 1 600 €/mois.
Une enveloppe supplémentaire de 700 € et une marge de 100 € donnent
800 € disponibles pour tous les projets : 150 € réservés à l’autre projet,
650 € au sélectionné, dont 300 € supplémentaires. Le maximum du sélectionné
est de 1 450 €. Les dates sont octobre 2027 / janvier 2027 / mai 2027
pour planned / maximum / reasonable, sans déficit de report.
Le mois courant reste un état séparé et n’ajoute rien à l’épargne déclarée.

## Vérification

Les suites `test:financial-goals-domain` et `test:financial-goals-api` couvrent
le contrat, les reports, les plafonds et les cas limites.
`test:financial-goals-persistence` inclut une lecture MySQL pendant une
modification concurrente de versement et de revenu, et vérifie l’absence
d’écriture financière (hors expiration existante). Cette suite exige la
base jetable décrite dans `docs/test-environment.md`.
