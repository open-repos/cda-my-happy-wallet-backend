# Simulation budgétaire

Un événement **confirmé** est prévu, mais pas encore réel : seule sa réalisation
crée une opération réelle. Un événement **potentiel** est une hypothèse enregistrée
pour la Simulation. Il ne modifie ni le solde réel, ni les versements des objectifs.

## Contrat API

Toutes les routes utilisent le propriétaire authentifié, jamais un identifiant
fourni dans le corps ou la requête. Les DTO d'événements et d'occurrences incluent
`status: CONFIRME | POTENTIEL`.

| Action                      | Route                                                      | Comportement                                                                    |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Créer                       | `POST /events`                                             | `status` facultatif, `CONFIRME` par défaut                                      |
| Lister                      | `GET /events`                                              | Confirmés seuls ; `status=POTENTIEL` pour la liste Simulation                   |
| Lire / modifier / supprimer | `GET /events/:id`, `PUT /events/:id`, `DELETE /events/:id` | Propriétaire seul, 404 sinon                                                    |
| Confirmer                   | `POST /events/:id/confirm`                                 | Sans paramètres ; idempotent ; montant, dates, récurrence et identité conservés |
| Vider la Simulation         | `DELETE /simulation/events`                                | Sans paramètres ; 204 idempotent ; potentiels et leurs résolutions seulement    |
| Occurrences                 | `GET /event-occurrences?month=YYYY-MM`                     | Confirmés seuls, sauf `scenario=simulation`                                     |

`PUT` conserve le statut lorsqu'il est omis. Un changement de statut y est refusé
(422 `INVALID_STATUS_TRANSITION`) : la confirmation passe exclusivement par sa
route dédiée, sans rétrogradation d'un confirmé en potentiel. Un potentiel passé
ne peut être créé ou déplacé dans un mois terminé (422 `EXPIRED_POTENTIAL`).
Réaliser ou annuler une occurrence potentielle renvoie 422 `EVENT_NOT_CONFIRMED`.
Il faut d'abord confirmer l'événement.

Les routes suivantes acceptent `scenario=standard|simulation`, avec `standard`
par défaut. Les valeurs inconnues, tableaux et paramètres répétés sont refusés.

- `GET /budget-periods/:month/summary?currency=EUR` : seule la partie prévision du
  mois courant inclut les potentiels en Simulation ; les bilans réels et clôturés
  restent inchangés.
- `GET /budget-forecast?from=YYYY-MM&months=12&currency=EUR` : ajoute les potentiels
  aux prévisions mono ou multi-mois, y compris dans les reports projetés.
- `GET /savings-capacity?from=YYYY-MM&months=12&currency=EUR` : même scénario pour
  les soldes avant objectifs, après versements prévus et après versements requis.

Les paramètres de pagination restent identiques ; les curseurs sont liés au
propriétaire et au filtre de statut ou de scénario. Un curseur Simulation n'est
pas réutilisable dans la liste habituelle. Le client doit conserver le scénario
associé à sa requête ; aucune Simulation n'est activée globalement.

## Expiration

La date civile de référence est calculée en **Europe/Paris**. Au premier instant
du mois suivant le mois de `startDate`, un potentiel non confirmé est supprimé
définitivement, ainsi que ses éventuelles résolutions. Une série récurrente expire
donc entièrement selon son ancrage initial, même si elle possède des occurrences
futures. Les confirmés, le mois courant et les mois futurs sont conservés.

Le nettoyage idempotent s'exécute avant les lectures de règles, occurrences,
occurrences en attente, résolutions et mouvements prévus utilisés par la synthèse,
la prévision et la capacité d'épargne. Il ne dépend pas du mois demandé. Les règles
éligibles sont verrouillées et leurs résolutions supprimées dans la même transaction
que les règles ; une confirmation concurrente utilise le verrou de la même ligne.
Un propriétaire inactif est nettoyé à sa prochaine lecture concernée. Aucun cron
ni service supplémentaire n'est requis pour cette garantie ; il n'existe pas de
suppression globale entre propriétaires dans l'API.

Les prévisions ne créent ni ne clôturent de période et ne réalisent aucune
occurrence. L'expiration ci-dessus est leur seule écriture de maintenance : elle
constitue une exception à leur caractère auparavant strictement sans écriture.

## Migration et déploiement

`20261019180000_add_event_simulation` ajoute le statut (défaut `CONFIRME`) et son
index. Elle ne réécrit aucun montant ni aucune date. Tous les événements existants
restent confirmés. La migration est appliquée avant sélection du nouveau backend
et n'est pas annulée par un rollback applicatif.

**Rollback :** un backend antérieur ignore le statut et compterait les potentiels
comme des événements normaux. Ne pas revenir à cette version tant que des potentiels
existent. Préférer une correction compatible ; toute conversion ou suppression
avant rollback nécessite une décision explicite du propriétaire. L'expiration et
le vidage sont des suppressions définitives, pas des migrations destructrices.

## Vérification

- `npm run test:monthly-events-domain` : statuts, expiration, fin de mois à Paris.
- `npm run test:monthly-events-api` : isolation, propriétaire, confirmation, vidage,
  validation et propagation du scénario vers les prévisions et la capacité.
- `npm run test:monthly-events-persistence` : filtres SQL, curseurs, synthèse,
  capacité, interdiction de réaliser un potentiel, expiration et résolutions.
- `npm run test:monthly-events-migration` : répétition de migration sur base jetable,
  défaut confirmé et conservation des valeurs historiques.

Les tests MySQL exigent `NODE_ENV=test` et la base jetable
`myhappywallet_test` sur `my-happy-wallet-mysql-test`. Ils ne doivent jamais être
lancés sur des données réelles.
