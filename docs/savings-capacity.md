# Capacité d'épargne et effort des objectifs (M12-03)

`GET /v1/savings-capacity?from=2026-10&months=12&currency=EUR`

La route est authentifiée et ne modifie pas les objectifs ni les bilans. Elle
supprime cependant les potentiels expirés avant lecture. `scenario=simulation`
inclut explicitement les autres potentiels ; ils sont exclus par défaut. Voir
[Simulation](budget-simulation.md). Elle utilise le même contrat de
fenêtre que [la prévision multi-mois](budget-forecast.md) : `from` et `currency`
obligatoires, `months` de 1 à 24 (12 par défaut), départ dans le mois courant ou
l'un des 23 suivants. Les champs inconnus et les paramètres répétés sont refusés.
La devise est normalisée, sans conversion. Les lectures filtrent le propriétaire
authentifié et la devise ; aucun identifiant de propriétaire n'est accepté en entrée.

## Effort par objectif

Les objectifs atteints sont omis. Pour les autres, la réponse expose le versement
mensuel prévu, le versement requis et `monthlyContributionGap = requis - prévu`.
Un écart positif représente le versement manquant pour tenir la date, un écart
négatif représente l'excédent prévu. `includedInTotals` vaut `false` lorsque le
versement prévu est nul : cet objectif reste visible, mais ses deux versements
sont exclus des totaux, conformément au prévisionnel existant.

Le versement requis réutilise `FinancialGoal.forecast(referenceDate)`, avec les
règles décrites dans [financial-goals.md](financial-goals.md) : reste à épargner
divisé par le nombre de mois jusqu'à l'échéance, arrondi au centime supérieur.
Le premier versement futur est celui du mois suivant la référence. Une échéance
absente ou dont le mois est déjà atteint donne `null`, jamais un zéro implicite.

`totalRequiredMonthlyContribution` est `null` dès qu'au moins un objectif inclus
ne peut pas être évalué ; `unassessableCount` donne leur nombre. L'écart individuel
et le solde après versements requis restent également `null` quand ils sont inconnus.

## Comparaison des trajectoires

Comme M12-02, le calcul utilise un instantané courant : les versements prévus
et requis calculés à la date de référence sont répétés dans les mois projetés.
Il ne met pas à jour le montant déjà épargné et ne suppose pas qu'un objectif
a réellement reçu des versements. L'effort requis n'est donc pas recalculé avec
une date future et un montant épargné artificiellement inchangé.

Pour chaque mois, `k` compte tous les mois depuis le mois courant, inclus,
même si certains précèdent `from`. Les trois trajectoires sont indépendantes :

```text
avant objectifs = solde M12-02 + k × épargne mensuelle réservée par M12-02
après prévus = avant objectifs - k × total des versements prévus
après requis = avant objectifs - k × total des versements requis
```

Le mois courant part du reste réel corrigé des seules occurrences non résolues.
Les mois futurs ajoutent le socle et leurs événements, avec report positif ou
négatif. Le calcul en centimes entiers ne cumule aucun arrondi d'affichage et
refuse les dépassements d'entiers sûrs. Les DTO utilisent des chaînes à deux
décimales ; ils n'exposent ni propriétaire ni types Prisma.

## Indicateur descriptif de soutenabilité

| Valeur        | Règle du mois projeté                                             |
| ------------- | ----------------------------------------------------------------- |
| `NON_TENABLE` | Le solde après prévus ou le solde connu après requis est négatif. |
| `INDETERMINE` | Le solde après requis est inconnu, sans déficit déjà démontré.    |
| `TENDU`       | Les deux soldes sont connus et l'un d'eux est exactement nul.     |
| `TENABLE`     | Les deux soldes sont connus et strictement positifs.              |

Il s'agit d'un indicateur arithmétique sur les données saisies, sans seuil de
sécurité arbitraire ni conseil financier. Il ne garantit pas le paiement d'une
dépense avant l'arrivée d'un revenu au cours du mois.

## Validation et exploitation

`test:financial-goals-domain` couvre plusieurs objectifs, les exclusions, les
échéances inconnues, les déficits et les limites numériques.
`test:financial-goals-api` couvre le contrat HTTP, les bornes, l'authentification
et le contexte propriétaire/devise. `test:budget-projection-api` vérifie avec
MySQL les totaux, les trajectoires, l'isolation et l'absence de matérialisation
des périodes/résolutions lors d'une première lecture. Ces scripts sont déjà
appelés en CI, sans changement des workflows.

Aucune migration ni configuration supplémentaire. Le retour arrière applicatif
retire seulement cette nouvelle route ; les données restent inchangées.
