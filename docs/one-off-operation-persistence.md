# Persistance des catégories et opérations ponctuelles

## Décisions appliquées

`M03-02` introduit une structure d'expansion à côté des tables historiques
`Categorie` et `Operation` :

- `OperationCategoryTemplate` porte les quatre valeurs par défaut issues du
  catalogue existant ;
- `OperationCategory` est une copie personnelle, renommable et colorable ;
- `OneOffOperationRecord` porte les opérations non périodiques et conserve
  éventuellement l'identifiant historique de backfill.

Une contrainte composite relie l'opération à `(categoryId, userId)`. La base
refuse ainsi la catégorie d'un autre propriétaire. La suppression d'une
catégorie référencée utilise `ON DELETE RESTRICT`; la future API devra traduire
l'erreur de clé étrangère Prisma `P2003` en conflit HTTP `409`.

Les créations d'utilisateur passent par une transaction : les templates actifs
sont lus, puis copiés avec le compte. Une installation sans templates échoue
explicitement au lieu de créer un compte incomplet.

## Migrations

Les migrations sont séparées pour garder DDL et données vérifiables :

1. `20260809210000_expand_personal_operation_categories` crée les trois tables,
   index, unicités et clés étrangères sans altérer les tables historiques ;
2. `20260809211000_backfill_personal_operation_categories` crée les quatre
   templates, initialise tous les utilisateurs, conserve leurs catégories
   historiques utilisées et copie uniquement les opérations sans `Periodique`.

Le catalogue initial reste volontairement limité aux valeurs déjà versionnées :
Alimentation, Loisir, Imprevu et Autres. Les couleurs restent nulles tant qu'une
palette métier n'est pas décidée ; l'utilisateur peut ensuite les personnaliser.

## Préflight et vérification

Avant production, sauvegarder la base puis relever les compteurs suivants :

```sql
SELECT COUNT(*) AS users_before FROM Utilisateur;
SELECT COUNT(*) AS legacy_categories_before FROM Categorie;
SELECT COUNT(*) AS legacy_operations_before FROM Operation;
SELECT COUNT(*) AS legacy_one_off_before
FROM Operation o
LEFT JOIN Periodique p ON p.idPeriodique = o.id
WHERE p.idPeriodique IS NULL;
```

Déployer avec la commande habituelle dans l'image backend :

```bash
npm run db:deploy
```

Puis vérifier :

```sql
SELECT COUNT(*) AS templates FROM OperationCategoryTemplate;
SELECT userId, COUNT(*) AS category_count
FROM OperationCategory GROUP BY userId ORDER BY userId;
SELECT COUNT(*) AS copied_one_off FROM OneOffOperationRecord
WHERE legacyOperationId IS NOT NULL;
SELECT COUNT(*) AS owner_mismatches
FROM OneOffOperationRecord o
JOIN OperationCategory c ON c.id = o.categoryId
WHERE c.userId <> o.userId;
```

Les sorties attendues sont quatre templates, au moins quatre catégories par
utilisateur, autant de lignes `legacyOperationId` que d'opérations historiques
non périodiques, et zéro incohérence de propriétaire. Les tables historiques et
leurs compteurs doivent rester inchangés.

Dans la base Docker jetable, la recette complète est :

```bash
npx prisma migrate reset --force --skip-seed
npm run test:operations-migration
npm run test:operations-schema
```

Le premier test rejoue exactement les deux migrations sur des fixtures
historiques ponctuelle et périodique, puis confirme que seule la première est
copiée et que les données historiques restent présentes. Le second couvre
l'initialisation, la personnalisation, la contrainte de propriétaire et le refus
de suppression d'une catégorie référencée.

## Retour arrière

La phase est additive. Avant que les futurs repositories ne basculent leurs
lectures, le premier retour arrière consiste à redéployer la version applicative
précédente : elle continue d'utiliser `Categorie` et `Operation`.

Si les nouvelles tables doivent être retirées, sauvegarder d'abord leurs
comptages et exports, puis appliquer une nouvelle migration en avant qui les
supprime dans cet ordre : `OneOffOperationRecord`, `OperationCategory`,
`OperationCategoryTemplate`. Ne jamais modifier les deux migrations déjà
déployées et ne jamais supprimer les tables historiques dans ce rollback.
