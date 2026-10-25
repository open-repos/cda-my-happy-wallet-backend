# Lecture des décisions d'occurrences — #134

`GET /v1/event-occurrence-resolutions?from=2026-10-01&to=2026-10-31`
utilise l'authentification et la pagination existantes (`limit` 1–100, 50 par
défaut ; `cursor` opaque). Les deux dates civiles sont obligatoires, inclusives,
valides et ordonnées ; la fenêtre couvre au maximum 366 jours. Les paramètres
inconnus et curseurs invalides retournent 422 ; l'absence de session retourne 401.

La fenêtre inclut une décision lorsque **la date d'occurrence ou la date de
l'opération liée** appartient à cette fenêtre. Cette union conserve le lien
quand une occurrence d'octobre est réalisée en novembre. Une décision n'apparaît
qu'une fois même si les deux dates correspondent. L'ordre stable est
occurrenceDate, sourceEventId, id ; un curseur est lié au propriétaire et aux
bornes. La date utilisée pour trier peut donc être extérieure aux bornes quand
c'est l'opération réelle qui les satisfait. Aucun montant n'est recalculé.

L'enveloppe `data/meta` est celle des collections existantes. Chaque décision
réutilise exactement le DTO de la commande de réalisation/annulation :
`eventId`, `occurrenceDate`, `status` (REALIZED/CANCELED), `title`, `amount`,
`currency`, `kind`, `resolvedAt`, `operation`. Le dernier champ est null si
annulée ou si l'opération a été supprimée, sinon contient `id`, `title`,
`amount`, `operationDate`, `categoryId`. Le titre/montant d'instantané restent
séparés des valeurs actuelles de l'opération. Aucun propriétaire ou identifiant
interne de résolution n'est publié. Les liens sont filtrés au même propriétaire.

Les décisions restent lisibles après suppression de la règle ; une suppression
d'opération conserve REALIZED avec un lien null. Une règle CONFIRME reste une
prévision : elle ne devient réelle que via une décision REALIZED et une
opération. POTENTIEL reste hypothétique, jamais un mouvement réel. Cette route
n'expose pas de statut inventé et ne modifie ni synthèse ni formule.

## Architecture et validation

Interface de lecture distincte des mutations, cas d'usage injecté, contrôleur de
lecture dédié et même mapper de DTO que les commandes. Aucun endpoint existant
n'est modifié. Aucun nouveau schéma, secret, dépendance ni migration. L'adaptation
TransactionClient introduite pour les trajectoires d'épargne est conservée.

Les tests de cas d'usage incluent le contrat HTTP, authentification/propriétaire,
instantané et date réelle différente, liens nuls, pagination et validation civile.
La suite MySQL existante vérifie 103 décisions sur plusieurs pages, les liens
supprimés, la lecture par date réelle et les curseurs déplacés de propriétaire
ou de période. Ces tests SQL nécessitent la base jetable et restent à exécuter
en CI si MySQL/Redis ne sont pas disponibles localement. Ne pas contourner les
garde-fous. Le frontend #293/#294 doit attendre la fusion de ce contrat avant
son branchement réel. #292 décrit le chantier complet.
