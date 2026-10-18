# Cache HTTP des réponses privées

Issue : [#98](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/98).
Parent : [frontend #47](https://github.com/open-repos/cda-my-happy-wallet-frontend/issues/47).

## Contrat

Toute réponse servie sous `APP_BASE_URL` (`/v1` par défaut) porte
`Cache-Control: private, no-store`, succès comme erreur. Cela couvre :

- les sessions Web et natives : connexion, renouvellement, révocation,
  déconnexion ;
- les données financières et les comptes ;
- les refus `401`, `403`, `404`, `409`, `422`, `429` et `500` ;
- les erreurs produites avant le routeur : corps JSON invalide (`400`), corps
  trop volumineux (`413`), origine CORS refusée (`403`), route inconnue (`404`).

Le navigateur, un proxy ou un service worker ne doit donc stocker aucune de ces
réponses, y compris au premier chargement, avant qu'un service worker ne
contrôle la page.

Aucune réponse n'est réutilisable par validation conditionnelle :

- le serveur n'émet aucun `ETag` (`etag` désactivé dans Express) ;
- `If-None-Match` et `If-Modified-Since` sont retirés des requêtes API. Sans
  cela, Express répond `304` à `If-None-Match: *`, même sans `ETag`.

## Hors périmètre

- `/health/live` et `/health/ready` gardent `Cache-Control: no-store`.
- `/api-docs` garde la politique de Helmet et de `swagger-ui-express`. Ses
  fichiers servis par `express.static` gardent leur `ETag`; la page HTML et
  `swagger-ui-init.js`, envoyés par `res.send`, n'en ont plus.
- Les contrats JWT, cookies, authentification et calculs ne changent pas.

## Mise en œuvre

Le [middleware](../src/middlewares/privateApiCache.middleware.ts) est monté
sur `APP_BASE_URL` juste après les en-têtes de sécurité, avant les analyseurs
de corps, CORS et le routeur. Aucune route ne réécrit `Cache-Control`. Une
nouvelle route ajoutée sous le préfixe hérite donc du contrat.

## Vérification

```bash
npm run test:private-api-cache
```

Le test utilise la base jetable `myhappywallet_test` et des comptes
synthétiques. Il échoue si l'en-tête disparaît d'une des réponses couvertes,
si un `ETag` réapparaît ou si une requête conditionnelle obtient un `304`.
