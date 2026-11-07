# Comptes d’épargne (Coffre)

Contrat de l’issue backend #183, enfant de
[frontend #394](https://github.com/open-repos/cda-my-happy-wallet-frontend/issues/394).
Le propriétaire valide ce contrat et les formules avant fusion. Les interfaces
web/mobile et les choix automatiques de clôture relèvent des issues liées.

## Soldes et incidence sur le budget

Tous les nouveaux montants sont des **centimes entiers**, de 0 à 9 999 999 999.
Un mouvement est strictement positif. Les devises sont normalisées en trois
lettres majuscules ; aucun change n’est effectué.

```text
solde épargne = solde initial + dépôts − retraits
reste réel courant = calcul réel existant − virements TO_SAVINGS + virements FROM_SAVINGS
prévision = calcul prévisionnel existant − virements mensuels non résolus
```

Le serveur maintient le solde à partir du solde initial et du registre immuable,
dans une transaction verrouillant le propriétaire. Un retrait ne peut rendre le
solde négatif. Une transaction qui dépasse la limite échoue entièrement. Le
solde initial décrit une épargne préexistante : il ne débite pas le compte courant.

Les virements ont le type public `VIREMENT` et leur propre registre. Ils entrent
dans les mouvements réels du budget, les totaux de sorties/entrées du résumé,
le reste à vivre du jour et les reports. Ils ne créent aucune
`OneOffOperationRecord` : les dépenses **et** les revenus des Analyses restent
inchangés. Un virement daté dans un mois passé recalcule les bilans et les
reports concernés dans la même transaction que le registre.

Le compte courant représente les flux déjà gérés par l’application. Son
`balanceMinorUnits` est le reste réel signé existant : base fixe, report et
mouvements réels, rapprochements compris. `balanceBasis: "AVAILABLE_BUDGET"`
explicite cette convention ; ce n’est pas un solde bancaire connecté. Son
historique réunit les opérations ponctuelles et les virements. La base fixe et
le report sont détaillés dans `budget`, sans fabriquer de paiements pour les
charges fixes.

## Routes authentifiées

Les réponses unitaires sont `{ "data": ... }`. Les quatre collections utilisent
la [pagination partagée](api-pagination.md) : `limit` (50 par défaut,
100 maximum), curseur opaque lié au propriétaire et aux filtres, enveloppe
`{ data, meta: { limit, hasNext, nextCursor } }`.

| Méthode et route                               | Corps ou filtres                                              | Résultat                                                              |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `POST /savings-accounts`                       | `name`, `currency`, `initialBalanceMinorUnits` facultatif (0) | Compte, 201                                                           |
| `GET /savings-accounts`                        | Pagination                                                    | Comptes, archivés compris, par identifiant croissant                  |
| `GET /savings-accounts/:id`                    | —                                                             | Compte et solde                                                       |
| `PATCH /savings-accounts/:id`                  | `name` et/ou `archived: true`                                 | Compte renommé ou archivé                                             |
| `PUT /savings-accounts/:id/goal`               | `goalId` entier                                               | Compte rattaché à un objectif                                         |
| `POST /savings-accounts/:id/transfers`         | Voir exemple                                                  | Virement, 201, y compris lors d’une répétition identique              |
| `GET /savings-accounts/:id/movements`          | Pagination                                                    | Registre, insertion la plus récente d’abord                           |
| `GET /savings-occurrences/pending`             | `month`, `currency`, pagination                               | Virements mensuels à confirmer                                        |
| `PUT /savings-accounts/:id/occurrences/:month` | `status: "CONFIRMED"` ou `"CANCELED"`                         | Décision et `movement` (null si refus)                                |
| `GET /accounts/current`                        | `month`, `currency`                                           | Solde réel et résumé du budget                                        |
| `GET /accounts/current/movements`              | `month`, `currency`, pagination                               | Opérations et virements, date décroissante puis source et identifiant |

`month` est `YYYY-MM`, par défaut le mois civil courant à Paris. `currency`
vaut `EUR` par défaut. Le résumé réel n’accepte pas de mois futur ; la liste
prévue peut être consultée pour un mois futur. Le détail OpenAPI expose les
schémas de requête et de réponse.

Exemple de dépôt manuel :

```json
{
  "direction": "TO_SAVINGS",
  "amountMinorUnits": 12345,
  "operationDate": "2026-11-07",
  "reason": "MANUAL",
  "idempotencyKey": "depot-vacances-20261107"
}
```

`FROM_SAVINGS` effectue le trajet inverse. `reason` vaut `MANUAL` par défaut ;
`MONTH_END` exige `TO_SAVINGS`, et `NEGATIVE_COVERAGE` exige `FROM_SAVINGS`.
Ces motifs enregistrent une décision explicite, sans calculer d’allocation de
clôture (#184). `GOAL` et les clés commençant par `goal:` sont réservés à la
confirmation mensuelle. Les dates impossibles et les virements futurs sont
refusés. Le corps n’accepte ni propriétaire ni solde calculé.

La clé d’idempotence est sensible à la casse et unique par propriétaire (8 à 100 caractères ASCII,
lettres, chiffres, `:`, `_`, `-`). Répéter exactement le même transfert renvoie
son mouvement initial, même après archivage. Réutiliser sa clé avec un autre
compte, montant, sens, motif ou jour produit un conflit. Le registre n’est ni
modifiable ni supprimable par l’API. Un archivage conserve solde et historique,
et bloque les nouveaux virements et les occurrences prévues.

## Objectifs et confirmations mensuelles

Un compte a au plus un objectif et un objectif au plus un compte. Les deux
ressources doivent appartenir au propriétaire authentifié et avoir la même
devise. Pour reprendre un `savedAmount` positif, le compte doit être vierge
(solde initial nul et aucun mouvement) : ce montant devient son solde initial.
Un compte déjà alimenté ne peut absorber silencieusement une seconde épargne.
Un objectif dont `savedAmount` vaut zéro peut utiliser un compte déjà alimenté.
Répéter le même rattachement ne réimporte rien.

Les réponses `/goals` et `/goals/:id` ajoutent `savingsAccountId` uniquement
pour un objectif rattaché. Son `savedAmount` et sa progression proviennent du
solde du compte, dépôts et retraits compris. Le `savedAmount` historique reste
stocké pour la compatibilité. La modification classique d’un objectif rattaché
accepte ses autres champs, mais exige le solde courant dans `savedAmount` et la
même devise ; changer manuellement cette progression produit un conflit.
Les objectifs non rattachés conservent leur comportement et leurs réponses.
Supprimer un objectif conserve le compte, le registre et les décisions passées.

Un objectif rattaché, non atteint et de versement mensuel positif produit une
occurrence virtuelle par mois. Le premier jour prévu est le jour du rattachement,
puis le premier jour des mois suivants. Le montant est le versement mensuel
**entier**, sans plafonnement au montant restant de l’objectif, comme la réserve
mensuelle existante. Tant qu’une décision n’est pas prise, les occurrences
suivent les paramètres courants de l’objectif et le solde courant du compte.
Les lectures ne matérialisent ni occurrence ni mouvement.

Ces occurrences sont disponibles dans `/savings-occurrences/pending`, à côté
du contrat existant `/event-occurrences/pending` pour les événements. Les futurs
clients combinent les deux collections. La confirmation conserve un reçu durable
et crée exactement un virement. Une répétition ou deux confirmations concurrentes
renvoient le même mouvement. Le refus conserve seulement le reçu ; changer une
décision est un conflit. La clé compte/mois reste consommée après suppression
ou remplacement de l’objectif. Les décisions futures sont refusées.

La réserve scalaire `goalSavingsMinorUnits` du budget exclut désormais les
objectifs rattachés. Leurs occurrences non résolues entrent dans les sorties
prévues, une seule fois. Confirmer remplace le prévu par le réel et laisse donc
la prévision inchangée ; refuser libère la réserve sans modifier le réel.
Les calculs de capacité et de trajectoire retirent aussi ces réserves avant
leurs scénarios indépendants, pour éviter une double soustraction.

## Erreurs et isolation

Les erreurs conservent l’enveloppe API existante et ajoutent un code stable dans
`error.details.code`.

| Statut | Codes                                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 404    | `NOT_FOUND` (ressource absente ou appartenant à un autre propriétaire)                                                                                                                                                      |
| 409    | `INSUFFICIENT_SAVINGS`, `BALANCE_LIMIT`, `ACCOUNT_ARCHIVED`, `GOAL_ALREADY_LINKED`, `CURRENCY_MISMATCH`, `OPENING_BALANCE_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `OCCURRENCE_ALREADY_RESOLVED`, `LINKED_GOAL_BALANCE_READ_ONLY` |
| 422    | `INVALID_REQUEST`, `INVALID_ACCOUNT`, `INVALID_AMOUNT`, `INVALID_DATE`, `INVALID_DIRECTION`, `INVALID_REASON`, `INVALID_IDEMPOTENCY_KEY`                                                                                    |

Les identifiants et la pagination conservent leurs erreurs partagées (400/422).
L’absence d’authentification conserve le contrat 401. Les clés étrangères
composites empêchent un mouvement ou un rattachement entre propriétaires.

## Migration, compatibilité et retour arrière

La migration additive `20261107185000_add_savings_accounts` ajoute quatre tables,
leurs clés et contraintes, ainsi qu’un index unique composite sur les objectifs.
Elle ne transforme aucun objectif existant : le rattachement et la reprise du
solde sont explicites, transactionnels et répétables sans doublon. Aucun nouveau
secret ni paramètre de production n’est requis. MySQL 8 est requis pour les
contraintes `CHECK`.

Les migrations de production précèdent la sélection du nouveau conteneur et ne
sont pas annulées par un retour arrière applicatif. Avant le premier usage du
Coffre, l’ancien backend peut fonctionner avec ces ajouts inutilisés. **Après
le premier virement, revenir à un ancien binaire qui ignore le registre
fausserait les recalculs du budget.** Conserver alors une version compatible
avec le registre et privilégier une correction applicative.

Pour un abandon explicite validé par le propriétaire : bloquer les nouvelles
écritures, sauvegarder/exporter les quatre tables et les bilans, rapprocher les
soldes et les reports, reporter la progression courante dans les objectifs
rattachés, puis définir la conservation comptable des virements avant tout retour
à un ancien binaire. Ne pas convertir les virements en dépenses/revenus : cela
modifierait les Analyses. Après conservation des données et validation du plan,
les tables se retirent dans l’ordre `SavingsOccurrenceResolution`,
`SavingsMovement`, `SavingsGoalLink`, `SavingsAccount`, puis l’index
`ObjectifFinancier_id_userId_key`. Cette suppression est destructive, n’est pas
une migration de déploiement et n’est jamais exécutée automatiquement.

## Validation

Les suites `test:savings-domain`, `test:savings-api`,
`test:savings-persistence` et `test:savings-migration` sont intégrées à la CI.
Elles couvrent les centimes, les droits, les erreurs HTTP, la pagination, la
reprise des objectifs, les confirmations concurrentes, les refus, la formule du
registre, l’exclusion des Analyses, les corrections de reports et la migration
avec données historiques. Les suites budget, objectifs, rapprochements et
pagination restent requises ; utiliser exclusivement les services jetables du
[parcours de test](test-environment.md).
