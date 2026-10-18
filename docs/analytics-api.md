# API d'agrégat des opérations

## Statut

- Work Item : `M05-11` (#78)
- Consommateurs : explorateur Web `M05-12` (frontend #104), mobile `M05-06`
- Décision : graphiques Apache ECharts configurables (11 octobre 2026)

## Route

`GET /v1/analytics/operations?from=&to=&currency=&groupBy=&splitBy=&kind=`

La route exige le jeton d'accès; le propriétaire est filtré dans la requête
SQL. Seules les opérations réelles (`OneOffOperationRecord`) sont agrégées :
les prévisions et occurrences planifiées restent hors périmètre.

| Paramètre  | Obligatoire | Valeurs                                                          |
| ---------- | ----------- | ---------------------------------------------------------------- |
| `from`     | oui         | date civile `YYYY-MM-DD`, incluse                                |
| `to`       | oui         | date civile `YYYY-MM-DD`, incluse, égale ou postérieure à `from` |
| `currency` | oui         | code ISO à trois lettres; aucune conversion                      |
| `groupBy`  | oui         | `day`, `week`, `month`, `year`, `category`, `kind`               |
| `splitBy`  | non         | `category` ou `kind`, seulement avec un regroupement temporel    |
| `kind`     | non         | `DEPENSE` ou `ENTREE`; absent = les deux                         |

Tout autre paramètre, dont `ownerId`, est refusé en `422`.

## Regroupements

- `day` : `YYYY-MM-DD`; `month` : `YYYY-MM`; `year` : `YYYY`.
- `week` : semaine ISO libellée par son lundi `YYYY-MM-DD`. Une période qui
  commence ou finit en milieu de semaine produit des semaines partielles :
  seules les opérations de la période sont comptées.
- Les regroupements temporels renvoient toutes les clés de la période, avec
  des zéros, dans l'ordre chronologique.
- `kind` renvoie les sens du filtre (`DEPENSE`, `ENTREE`), même vides.
- `category` renvoie les catégories ayant des opérations, triées par volume
  (entrées + dépenses) décroissant; `key` est l'identifiant, `label` et
  `color` décrivent la catégorie.
- `splitBy` ajoute `series` à chaque seau : toutes les séries observées sur la
  période, triées par volume décroissant, avec des zéros, pour des graphiques
  empilés.

Les dates sont des dates civiles stockées en `DATE` et les clés sont calculées
en UTC : aucun fuseau ni changement d'heure n'intervient. Les tests le
vérifient sous plusieurs fuseaux de processus, dont `Europe/Paris` autour des
29 mars et 25 octobre 2026.

## Réponse

```json
{
  "data": {
    "currency": "EUR",
    "from": "2028-02-01",
    "to": "2028-03-31",
    "groupBy": "month",
    "splitBy": "category",
    "kind": "DEPENSE",
    "buckets": [
      {
        "key": "2028-02",
        "label": null,
        "color": null,
        "income": "0.00",
        "expense": "30.11",
        "net": "-30.11",
        "count": 3,
        "series": [
          {
            "key": "7",
            "label": "Loisirs",
            "color": null,
            "income": "0.00",
            "expense": "20.00",
            "net": "-20.00",
            "count": 1
          }
        ]
      }
    ]
  }
}
```

Les montants sont des chaînes décimales à deux chiffres calculées en centimes
entiers; `net = income − expense` peut être négatif. Aucun identifiant de
propriétaire n'est exposé.

## Bornes et erreurs

| Regroupement                | Période maximale |
| --------------------------- | ---------------- |
| `day`                       | 366 jours        |
| `week`                      | 156 semaines     |
| `month`, `category`, `kind` | 120 mois         |
| `year`                      | 30 ans           |

Une réponse compte au plus 500 points (seaux × séries), y compris sans
ventilation (catégories utilisées non plafonnées). Au-delà, ou pour une
période trop large, la route répond `422` avec
`error.details.code = ANALYTICS_RANGE_TOO_LARGE`.

- La limite des périodes et `splitBy=kind` (1 ou 2 séries) est vérifiée avant
  toute lecture : le client peut la prévoir.
- Avec `groupBy=category` ou `splitBy=category`, le nombre de catégories
  dépend des données : la même requête peut passer ou être refusée selon les
  catégories utilisées. Le client réduit alors la période.
- Une période inversée répond `422` avec
  `error.details.code = ANALYTICS_QUERY_INVALID`; un autre paramètre invalide
  répond `422` sans code métier; un jeton absent `401`.

## Performance et compatibilité

L'agrégation est faite en SQL (`GROUP BY` sur des expressions fixes, sans
interpolation de paramètres dans le SQL brut) et s'appuie sur l'index
existant `(userId, currency, operationDate, id)`. Aucune migration. Retour
arrière : redéployer la version précédente; aucun autre contrat n'est modifié.

## Tests

- `npm run test:analytics-domain` : clés temporelles, semaines ISO à cheval
  sur deux années, années bissextiles, bornes, centimes et ventilations.
- `npm run test:analytics-api` : contrat HTTP, `401`/`422`, centimes exacts,
  exclusion des autres devises et propriétaires, index utilisé (MySQL jetable).
