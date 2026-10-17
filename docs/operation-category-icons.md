# Icônes Font Awesome des catégories

Issue : #84 (parent #83). Une catégorie d'opérations peut porter une icône Font
Awesome 6 Free en plus de son nom et de sa couleur. Sans icône, les clients
affichent la pastille de couleur actuelle.

## Contrat

- Colonne `OperationCategory.icon`, `VARCHAR(64)` nullable, ajoutée par la
  migration additive `20261017120000_add_operation_category_icon`. Les
  catégories existantes restent à `NULL`.
- Format échangé et stocké : `<style>:<nom>`, avec `style` valant `solid` ou
  `regular`, par exemple `solid:utensils`. Les icônes `brands` et Pro sont
  exclues.
- `POST /v1/operation-categories` : `icon` facultatif, `null` par défaut.
- `PUT /v1/operation-categories/:id` : `icon` absent conserve l'icône
  existante, afin qu'un client qui ne connaît pas encore le champ ne l'efface
  pas; `null` revient à la pastille; une valeur valide la remplace.
- Les DTO de catégorie exposent toujours `icon` (`string` ou `null`).
- Toute autre valeur (format, style, nom hors liste, majuscules, espaces, type
  non textuel) répond `422` avec `error.details.code = INVALID_CATEGORY_ICON`.
- La modification reste limitée au propriétaire : une catégorie d'un autre
  compte répond `404`, comme une catégorie absente.

## Liste autorisée

`src/modules/operations/domain/categoryIcons.json` est l'intersection des noms
disponibles à la fois sur le Web (`@fortawesome/free-solid-svg-icons` et
`@fortawesome/free-regular-svg-icons`) et sur le mobile (table `FontAwesome6`
Free de `@expo/vector-icons`). Une icône choisie sur l'un s'affiche donc sur
l'autre. Le fichier indique sa date de génération, son script et les versions
sources. Génération du 2026-10-17 : 1 381 `solid` et 162 `regular`, depuis les
paquets Web 6.1.1 et `@expo/vector-icons` 15.1.1.

Seuls les noms canoniques sont retenus; les alias historiques de Font Awesome
ne sont pas acceptés.

## Régénération

À relancer quand l'un des paquets sources change de version, avec les
dépendances frontend installées (`npm ci` à la racine et dans `mobile/`) :

```bash
docker compose -f docker-compose.agent.yml exec agent-node bash -lc \
  'cd my-happy-wallet-backend && node scripts/generate-category-icons.js --date AAAA-MM-JJ'
```

`--frontend <dossier>` désigne un autre checkout frontend. Le script échoue si une
version installée diffère du `package-lock.json` correspondant (volume
`node_modules` d'`agent-node` périmé) : relancer `npm ci` dans ce conteneur. Une icône retirée de
la liste n'invalide pas les valeurs déjà stockées : elles restent lisibles,
mais une nouvelle écriture de cette valeur est refusée. Vérifier le diff avant
de committer.

## Retour arrière

Les clients ignorent `icon` tant qu'ils ne le lisent pas. Pour revenir en
arrière, déployer la version précédente du code : la colonne nullable peut
rester en base sans effet. Ne la supprimer que par une nouvelle migration.

## Tests

- `OneOffOperationUseCases.test.ts` : formats acceptés et refusés, conservation
  au `PUT`, retour à `null`, propriétaire.
- `OneOffOperationApi.test.ts` : DTO, `422 INVALID_CATEGORY_ICON`, `404` pour un
  autre compte, schéma OpenAPI.
- `OneOffOperationRepositories.test.ts` : persistance MySQL et isolation.
- `OperationCategoryIconMigration.test.ts` : migration sur une catégorie
  existante.
