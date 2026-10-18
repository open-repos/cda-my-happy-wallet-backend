# Tests des dates, récurrences et prévisions (M04-07)

Issue : [backend #24](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/24).
Les dépendances M04-02 (#23) et M04-03 (#21) sont terminées.

## Couverture et complément

Les suites préexistantes couvrent déjà l'ancrage au 31, les mois de 28 à 31 jours,
les années bissextiles, les centimes et les principaux statuts d'objectif. Les
ajouts de M04-07 portent sur les limites ci-dessous, sans changer le domaine.

| Sujet                    | Cas ajoutés                                                                                                                                                                                 | Suite                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Récurrence               | Ancrages 29 et 30 après février, sans dérive                                                                                                                                                | `test:monthly-events-domain`                                |
| Fenêtre d'un événement   | Avant le début, début = fin, fin inclusive, dernière occurrence rabattue incluse ou exclue à un jour près                                                                                   | `test:monthly-events-domain`                                |
| Validation               | Dates civiles impossibles, années séculaires 1900/2000/2100, mois mal formés, rejet des instants horodatés                                                                                  | `test:monthly-events-domain`, `test:financial-goals-domain` |
| Prévision                | Versement à un centime de la cible, versement nul avec échéance future, priorité d'un objectif exactement atteint malgré l'échéance passée                                                  | `test:financial-goals-domain`                               |
| Horizon                  | 1 200 versements affichables et 1 201 sans mois estimé                                                                                                                                      | `test:financial-goals-domain`                               |
| Date métier              | Minuit et changements d'heure de mars/octobre à Paris, changement d'année, trois fuseaux du processus avec restauration de `TZ`                                                             | `test:financial-goals-domain`                               |
| Horloge injectable       | GET et liste recalculés après un changement de mois ; même date de référence pour tous les objectifs d'une page                                                                             | `test:financial-goals-api`                                  |
| Pagination d'occurrences | Trois ancrages au même 29 février paginés sans doublon ni omission ; départage par identifiant ; exclusions avant/après la fenêtre ; curseur lié au mois, au propriétaire et à la ressource | `test:monthly-events-persistence`                           |

Les tests de domaine n'utilisent ni heure réelle, ni réseau, ni base. Le test API
utilise un dépôt en mémoire et une horloge injectée. Le test de persistance
vérifie le vrai SQL sur la base MySQL jetable de la CI ; il ne simule pas le tri
ou la pagination du dépôt dans un faux moteur SQL.

Les contrôles existants de `BudgetEdgeCases.test.ts` sont conservés et ne sont
pas dupliqués. Le contrat général des API et de leur pagination relève aussi
de M07-01 (#31).

## Exécution

Dans le checkout cloud isolé, avec les variables de test du workflow backend :

```bash
npm run test:monthly-events-domain
npm run test:financial-goals-domain
npm run test:financial-goals-api
npm run test:budget-edge-cases
```

La suite de persistance nécessite les migrations et la base jetable
`myhappywallet_test` du workflow GitHub Actions `Backend quality` :

```bash
npm run db:deploy
npm run test:monthly-events-persistence
```

Elle refuse de démarrer si `DATABASE_URL` ne contient pas le nom de la base
`myhappywallet_test` et l'hôte `my-happy-wallet-mysql-test`, comme le garde-fou
déjà utilisé par les tests d'intégration de pagination.

Ne pas diriger ces tests de persistance vers une base de développement, de
staging ou de production : leurs fixtures sont créées puis supprimées.
Depuis le workspace parent, utiliser les commandes Docker prescrites par
son `AGENTS.md`. Le checkout cloud et GitHub Actions autorisent l'exécution
directe conformément au `AGENTS.md` de ce dépôt.

Les scripts npm et la CI existants exécutent déjà ces fichiers. Aucun script,
workflow, dépendance, migration ou contrat API n'est ajouté ou modifié. Cette
livraison ne change pas le comportement visible et ne nécessite pas de fragment
de changelog.

## Sensibilité aux régressions

Trois altérations temporaires du code ont été détectées par les nouveaux tests :
refuser un événement dont début = fin, exclure la borne de 1 200 mois et lire
l'horloge une fois par objectif au lieu d'une fois par page. Le code a été
rétabli après chaque essai et les suites correspondantes sont repassées au vert.
Ces altérations ne font pas partie du commit.
