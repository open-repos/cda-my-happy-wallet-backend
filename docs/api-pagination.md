# Pagination des collections API

Toutes les routes `GET` de collection utilisent une pagination par curseur.
Le contrat est commun aux utilisateurs administrés, opérations fixes, revenus,
charges, catégories personnelles et opérations ponctuelles. Les futures
collections d'événements, objectifs et projections doivent le réutiliser.

## Contrat HTTP

Les paramètres de requête sont :

- `limit`, facultatif : entier de `1` à `100`, avec `50` par défaut ;
- `cursor`, facultatif : valeur opaque reçue dans la page précédente.

Une requête sans curseur commence au début de la collection. La réponse est
toujours bornée et utilise l'enveloppe suivante :

```json
{
  "data": [],
  "meta": {
    "limit": 50,
    "hasNext": false,
    "nextCursor": null
  }
}
```

Quand `hasNext` vaut `true`, le client transmet `nextCursor` sans l'interpréter
pour obtenir la page suivante. Le serveur ne fournit volontairement ni offset
SQL ni nombre total : ces informations sont coûteuses ou instables sur une
collection qui évolue. Un paramètre inconnu, une limite invalide ou un curseur
invalide retourne `422` avec un message générique.

## Ordres stables

Chaque ordre se termine par une clé unique :

| Collection | Ordre |
| --- | --- |
| Utilisateurs administrés | `id DESC` |
| Opérations fixes, revenus, charges | `idOperationFixe DESC` |
| Catégories personnelles | `name ASC, id ASC` |
| Opérations ponctuelles | `operationDate DESC, id DESC` |

Le repository demande `limit + 1` lignes pour calculer `hasNext`, puis retire
la ligne sentinelle de la réponse. Cette pagination par clé évite les doublons
et omissions causés par le décalage d'un offset lorsque de nouvelles lignes
sont insérées avant la fenêtre en cours.

## Sécurité et architecture

Le contrôleur valide les paramètres, le cas d'usage dépend d'une interface de
repository et l'adaptateur Prisma applique la fenêtre. Le composant partagé
`modules/pagination` centralise le contrat, la construction des pages et le
codec : les domaines ne dupliquent pas ces règles.

Le filtre propriétaire est appliqué dans la même requête SQL et avant les
conditions du curseur. Les curseurs sont versionnés, chiffrés et authentifiés
en AES-256-GCM. Ils contiennent un identifiant de ressource et un périmètre
d'autorisation chiffrés : un curseur ne peut donc pas être déplacé vers une
autre route ou un autre utilisateur. La clé est dérivée du secret d'accès avec
un domaine cryptographique distinct. Une rotation de ce secret invalide les
curseurs existants, qui retournent alors `422` et peuvent être repris depuis la
première page.

Les DTO ne publient ni propriétaire, ni structure interne du curseur, ni champ
d'authentification utilisateur. Les erreurs cryptographiques ne sont jamais
renvoyées au client.

## Migration et retour arrière

La migration `20260818190000_add_collection_pagination_indexes` ajoute quatre
index composites sans modifier les données ni supprimer les index existants.
Elle doit être déployée avant d'exposer les nouveaux contrats aux clients.

Prisma utilise des migrations avant uniquement. Si un retour arrière de
l'application est nécessaire, l'ancien backend peut fonctionner avec ces
index additionnels : il est préférable de les conserver. Après stabilisation,
leur retrait éventuel se fait dans une nouvelle migration contrôlée :

```sql
DROP INDEX `OperationFixe_userId_idOperationFixe_idx` ON `OperationFixe`;
DROP INDEX `OperationFixe_userId_typeOperation_idOperationFixe_idx` ON `OperationFixe`;
DROP INDEX `OperationCategory_userId_name_id_idx` ON `OperationCategory`;
DROP INDEX `OneOffOperationRecord_userId_operationDate_id_idx` ON `OneOffOperationRecord`;
```

Avant ce retrait, vérifier que plus aucun backend paginé ne reçoit de trafic.
L'OpenAPI constitue la référence du contrat HTTP et documente paramètres,
enveloppe, exemple et réponse `422` pour chacune des six routes.
