# Journal HTTP de développement

Issue : [#94](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/94).

## Problème corrigé

Le format Morgan `dev` contenait l'URL complète. Par exemple, même un lien
de réinitialisation refusé en `401` copiait son jeton de chemin et les valeurs
de query dans stdout. Un poste de développement peut recevoir des liens et
données privés ; son journal n'est pas une destination autorisée pour ces valeurs.

Le serveur conserve l'activation du journal d'accès uniquement lorsque
`NODE_ENV=development`. Il conserve aussi sa position dans les middlewares :
après les parsers, les routes de santé, Swagger et CORS, avant les routes API.
Les requêtes terminées ou rejetées avant ce point ne produisent toujours pas
de ligne d'accès. Aucun journal d'accès n'est ajouté en test ou production.

## Format et frontière de confiance

Le [middleware](../src/middlewares/requestLogger.middleware.ts) utilise une
[fonction de format Morgan](https://github.com/expressjs/morgan#using-a-custom-format-function)
qui construit une ligne JSON à partir d'une liste fermée de champs :

```json
{
  "event": "http_request",
  "method": "GET",
  "route": "/reset-password/:token",
  "status": 401,
  "responseTimeMs": 1.234
}
```

- `event` est constant ; `method` appartient à une liste de verbes HTTP usuels,
  sinon vaut `OTHER`.
- `route` est le modèle local enregistré dans le routeur, par exemple
  `/verify/:id/:token`, jamais les valeurs concrètes. Le préfixe de montage
  n'est pas ajouté : `baseUrl` peut lui aussi contenir un paramètre privé.
  Des modèles identiques dans plusieurs routeurs ne sont donc pas distingués.
- Si le modèle n'est pas une chaîne (route par expression régulière ou tableau)
  ou si aucune route n'est trouvée, `route` vaut `unmatched`, sans repli vers
  l'URL ou le chemin entrant.
- `status` et `responseTimeMs` viennent des tokens de réponse Morgan. Une
  mesure indisponible vaut `null`, notamment si aucune réponse n'a été envoyée.

Les modèles de route sont du code de confiance : ne pas construire leur
déclaration à partir de données utilisateur. Les URL, queries, paramètres
concrets, corps, cookies, en-têtes, IP et user-agent sont hors de la liste.
Ils ne sont pas lus pour composer cette ligne, même si leur nom n'évoque pas
un secret ou si leurs valeurs sont encodées. La sérialisation JSON maintient
les champs sur une seule ligne plutôt que d'interpréter du texte entrant.

Cette correction concerne uniquement le journal d'accès Morgan. Elle ne
modifie pas les erreurs/réponses HTTP ni les autres journaux applicatifs,
les proxies, les outils de développement ou leurs politiques de conservation.
Elle n'efface pas des journaux déjà écrits et ne constitue pas un audit de
toutes ces destinations.

## Vérification

Depuis un clone backend isolé sans `.env` après `npm ci` (la suite refuse un
checkout contenant ce fichier, pour éviter son chargement par dotenv) :

```bash
npm run test:request-logging
npm run type-check
npm run build
```

La sortie attendue est `Request logging privacy tests passed`, code `0`.
La suite ne demande aucun service externe et n'installe aucune dépendance.
Elle capture les journaux de requêtes synthétiques, contrôle la liste exacte
des champs et l'absence des marqueurs de jeton, identité, montant et en-tête.
Elle couvre les modèles imbriqués, routes inconnues/encodées, tableaux et
expressions régulières, et les statuts `201`, `204`, `401`, `404`, `500`.

Trois processus séparés chargent le vrai serveur en développement, test et
production : une racine `200`, deux liens invalides `401` refusés avant SQL
et une route inconnue `404` conservent leurs statuts ; seul le processus de
développement écrit les quatre lignes JSON. Une sonde de vie `200` et un corps
JSON invalide `400`, traités avant le logger, n'ajoutent aucune ligne. Les secrets sont synthétiques,
la sonde SQL est injectée et aucune connexion Redis n'est créée. Ce test
ne lance pas `src/index.ts` et ne remplace pas la validation du démarrage
de production avec ses services obligatoires. Le
[parcours complet](test-environment.md) et la CI exécutent ensuite les suites
MySQL/Redis et les deux restaurations sur des bases jetables.

## Compatibilité et retour arrière

Un outil lisant l'ancien texte coloré Morgan doit maintenant lire du JSON ;
la route locale seule est volontairement moins précise pour les montages
paramétrés. Aucun endpoint, cookie, jeton, paramètre d'environnement, paquet
ou migration ne change.

Le revert de la PR rétablit aussi la fuite initiale : en cas de problème de
lecture, adapter le consommateur de logs ou retirer temporairement le
middleware de développement dans une correction revue, sans rétablir la
journalisation d'URL complètes. Aucune donnée SQL ni session n'est à migrer.
