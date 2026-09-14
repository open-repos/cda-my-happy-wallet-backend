# API des catégories et opérations ponctuelles

## Authentification et propriété

Toutes les routes sont placées sous la base `/v1` configurée par l'application
et exigent `Authorization: Bearer <access-token>`. L'identifiant propriétaire
vient exclusivement du token vérifié. Un `ownerId`, `userId` ou champ inconnu
dans le corps est rejeté en `422` et ne peut jamais modifier le périmètre.

Une ressource absente et une ressource appartenant à un autre compte produisent
la même réponse `404`. Les DTO publics n'exposent ni propriétaire, ni identifiant
de template, ni identifiant de migration historique.

## Ressources

| Méthode | Route | Succès | Usage |
| --- | --- | --- | --- |
| `GET` | `/operation-categories` | `200` | Lister les catégories personnelles |
| `POST` | `/operation-categories` | `201` | Créer une catégorie |
| `PUT` | `/operation-categories/:id` | `200` | Remplacer nom et couleur |
| `DELETE` | `/operation-categories/:id` | `204` | Supprimer une catégorie inutilisée |
| `GET` | `/operations` | `200` | Lister les opérations ponctuelles |
| `POST` | `/operations` | `201` | Créer une opération |
| `GET` | `/operations/:id` | `200` | Lire une opération |
| `PUT` | `/operations/:id` | `200` | Remplacer une opération |
| `DELETE` | `/operations/:id` | `204` | Supprimer une opération |

Les réponses unitaires avec contenu utilisent `{ "data": ... }`. Les deux
routes de collection acceptent `limit` et `cursor`, et retournent l'enveloppe
`{ "data": [], "meta": { "limit", "hasNext", "nextCursor" } }` décrite dans
[`api-pagination.md`](./api-pagination.md). Le montant public est une chaîne
décimale à deux chiffres afin de préserver sa représentation exacte. Le type
vaut `DEPENSE` ou `ENTREE`; la date reste une date civile `YYYY-MM-DD`.

## Erreurs

- `400` : identifiant de chemin invalide ;
- `401` : token absent, invalide ou expiré ;
- `404` : ressource absente du compte authentifié ;
- `409` : nom de catégorie déjà utilisé ou catégorie encore référencée ;
- `422` : corps, règle de domaine ou pagination invalide ;
- `500` : erreur inattendue, sans détail interne dans la réponse.

La documentation OpenAPI décrit les neuf opérations, leurs schémas fermés,
leurs exigences Bearer et les statuts possibles. La suppression restrictive
d'une catégorie référencée est traduite de `CATEGORY_IN_USE` vers HTTP `409`.

## Matrice de tests M03-07

La couverture est répartie selon la frontière testée :

- `OneOffOperation.test.ts` protège les invariants financiers et calendaires ;
- `OneOffOperationUseCases.test.ts` protège les cas d'usage sans infrastructure ;
- `OneOffOperationRepositories.test.ts` protège les conversions et contraintes
  Prisma dans MySQL ;
- `OneOffOperationApi.test.ts` protège rapidement validation, DTO et statuts
  avec des repositories en mémoire ;
- `BudgetApiIntegration.test.ts` traverse le vrai serveur, le middleware JWT,
  les services, Prisma et MySQL, et vérifie aussi le document OpenAPI.

Le dernier test utilise exclusivement la base Docker jetable dont l'hôte est
`my-happy-wallet-mysql-test` et le nom contient `myhappywallet_test`. Il refuse
de démarrer contre toute autre base et nettoie ses fixtures après exécution.
