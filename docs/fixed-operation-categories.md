# Catégories des charges et entrées fixes

Parent : frontend #268 ; backend #127 ; Web #266. Les 20 associations de catégories
et icônes Font Awesome ont été validées visuellement par le propriétaire.

## Contrat

Les POST/PUT `/v1/operations-fixes/charges` et `/revenus` acceptent `categoryId` :
entier positif ou `null`, facultatif. Absent à la création : non catégorisé.
Absent en modification : conserver le lien ; `null` : retirer le lien.
Les identifiants invalides gardent le 400 historique de validation des champs.
Une catégorie absente, étrangère ou incompatible renvoie 422 avec
`error.details.code = INVALID_FIXED_CATEGORY`, sans distinguer ces trois cas.

Les créations et lectures renvoient `categoryId` et `category` (ou `null`).
La catégorie imbriquée expose seulement `id`, `name`, `color`, `icon`, `fixedKind`.
Les réponses de PUT/DELETE restent `{success, message}` : relire après écriture.
Aucun calcul, périodicité, partage ni snapshot n'est modifié par la catégorie.

`GET /v1/operation-categories` reste le catalogue personnel commun. `fixedKind`
est présent pour les catégories spécialisées (`CHARGE` ou `REVENU`) ; absent
ou `null`, la catégorie personnelle/générale convient aux deux types. Les
clients existants ignorent ce champ supplémentaire. La restriction est
conservée lors de la modification du nom, de la couleur ou de l'icône ; elle
n'est pas modifiable depuis le corps de l'API de catégories. Il n'existe pas
d'archivage de catégories actuellement. Supprimer une catégorie référencée
par une opération fixe ou ponctuelle renvoie 409 `CATEGORY_IN_USE`.

## Migration et comptes

`20261024090000_fixed_operation_categories` ajoute un lien nullable avec clé
étrangère composite `(categoryId, userId)` vers le catalogue personnel, un
index, `fixedKind` nullable sur les catégories/modèles et `icon` sur les modèles.
Elle insère 12 modèles de charges et 8 d'entrées et leurs copies personnelles.
Les insertions de données sont rejouables ; le DDL est appliqué une fois par
Prisma. Un nom personnel existant, comparé selon la collation MySQL existante,
est conservé intégralement : aucune modification du nom, couleur, icône,
restriction ou rattachement au modèle. Aucun doublon n'est créé pour ce nom.
Une catégorie existante partagée reste donc disponible pour les deux types.
Les opérations anciennes gardent `categoryId = null`, sans heuristique.
Les futurs comptes copient les icônes et restrictions des modèles actifs
pendant la transaction d'inscription.

Déployer la migration avant le backend, puis le Web dépendant. Les migrations
précèdent la sélection du nouveau conteneur et ne sont pas annulées par un
rollback applicatif. Les colonnes peuvent rester en place avec l'ancien
backend, qui ignore la catégorie. Ne pas supprimer les colonnes ni restaurer
les noms ou icônes par script lors d'un rollback. Aucune migration n'est
exécutée sur staging ou production par cette tâche.

## Vérifications

`test:fixed-charges` couvre le contrat HTTP, les refus propriétaire/type,
l'omission et `null`, les DTO sans propriétaire et l'initialisation des 20
icônes autorisées pour l'inscription. La persistance simulée est explicitement
remplacée dans les tests HTTP. `FixedCategoriesPersistence.test.ts`, inclus
dans `test:repositories`, vérifie sur MySQL jetable le backfill exécuté deux
fois, les personnalisations préservées, les lignes anciennes non catégorisées,
l'inscription réelle, la clé étrangère d'isolation et le refus de suppression.
Ce test refuse toute autre base que `myhappywallet_test` sur l'hôte
`my-happy-wallet-mysql-test`. La CI existante le lance sans changement de workflow.
