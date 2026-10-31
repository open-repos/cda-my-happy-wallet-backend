# JWT : émetteur, audiences et bascule des sessions

Issue : [#35](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/35).
Dépendance [#33](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/33)
terminée. Cette évolution renforce les JWT existants : mot de passe, routes,
cookies, stockage natif et rotation des sessions gardent leurs mécanismes.

## Politique

Le [service JWT](../src/modules/auth/token/JsonWebTokenService.ts) signe en
HS256 avec `iss` et `aud`, puis impose ces mêmes valeurs à la vérification,
dans ses variantes synchrone et callback. Les options de signature fournies
par un appelant (y compris `header.alg`) ne remplacent pas l'algorithme ni la politique. Les contrôles
de signature et d'expiration restent actifs. Il n'existe aucun repli acceptant
les anciens jetons sans ces claims.

| Usage                      | Audience                                | Secret existant  | Durée existante                                 |
| -------------------------- | --------------------------------------- | ---------------- | ----------------------------------------------- |
| Accès Web/natif            | `JWT_AUDIENCE`                          | `ACCESS_TOKEN`   | 300 s à la connexion et après renouvellement    |
| Renouvellement Web/natif   | `JWT_AUDIENCE` suivi de `:refresh`      | `REFRESH_TOKEN`  | 7 j glissants, 30 j au plus, rotation persistée |
| Confirmation d'inscription | `JWT_AUDIENCE` suivi de `:registration` | `REGISTER_TOKEN` | 300 s                                           |

L'émetteur de ces trois usages vaut `JWT_ISSUER`. Les vérifications utilisent
des chaînes exactes, pas des expressions régulières ; la bibliothèque traite
une audience JWT sous forme de tableau selon son comportement documenté.
Les émetteurs de ce dépôt produisent une audience unique. Voir les options
[issuer/audience de jsonwebtoken](https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).

## Configuration

Les [valeurs validées](../src/config/jwtConfig.ts) sont des métadonnées publiques,
pas des secrets. Elles ne déclenchent aucun appel réseau ni découverte OAuth.
Chaque valeur doit contenir de 1 à 200 caractères ASCII imprimables sans espace.
Une valeur explicitement vide ou invalide est refusée sans être reprise dans
l'erreur.

| Variable       | Exemple de production                       | Comportement                                                           |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `JWT_ISSUER`   | `https://api.myhappywallet.andriacapai.com` | Obligatoire si `NODE_ENV=production`                                   |
| `JWT_AUDIENCE` | `urn:myhappywallet:production`              | Obligatoire en production ; audience d'accès et base des deux suffixes |

Sans configuration hors production, les valeurs locales sont
`urn:myhappywallet:local:issuer` et `urn:myhappywallet:local`. La CI définit
explicitement ses valeurs `urn:myhappywallet:test:issuer` et
`urn:myhappywallet:test`. Utiliser des secrets et des métadonnées distincts
entre production, staging et développement ; conserver les métadonnées stables
sur les réplicas d'un même environnement. Les trois secrets restent distincts
et longs d'au moins 32 caractères. Une rotation de métadonnées invalide elle
aussi les JWT en circulation.

La configuration est validée au chargement du backend. Le wrapper existant
charge celle de l'image candidate avant les migrations : il refuse donc une
configuration de production incomplète avant la révocation des sessions.
Voir [.env.example](../.env.example) et le [guide CI/CD](ci-cd.md).

## Modèle de menace et limites

- La signature prouve la possession de la clé ; `iss` lie le jeton à l'émetteur
  attendu et `aud` à son usage. Un jeton valide pour un autre émetteur ou usage
  est refusé, même dans les tests utilisant volontairement une même clé.
- Les clés distinctes restent nécessaires. Ces claims ne compensent pas une
  clé compromise et ne chiffrent pas le contenu du JWT.
- Les payloads métier restent validés : identifiant positif pour l'accès,
  identifiant/session UUID/jti pour le renouvellement, email lié au compte pour
  l'inscription. Le propriétaire ne vient jamais du corps ou du cookie `id_user`.
- Le renouvellement exige toujours le hash courant d'une session persistée
  non révoquée et non expirée. Le rejeu révoque la session ; une clé/audience
  correcte ne remplace pas ce contrôle.
- Les refus gardent les enveloppes publiques `401 Unauthorized` existantes,
  sans ajouter les erreurs techniques de vérification ni la configuration.
  Le [journal d'accès](request-logging.md) n'écrit pas les jetons.

Les recommandations de validation d'émetteur, d'audience et de séparation
des usages sont décrites dans [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html).
Cette livraison couvre ces frontières JWT, pas une refonte de l'authentification.

## Impact Web et mobile

Les jetons sont opaques pour les clients. Les routes, noms de champs, durées
et attributs des cookies restent ceux des [contrats API](api-contracts.md).
Le Web continue à renouveler via son cookie et le mobile via `refreshToken`
dans le corps ; il n'y a pas de nouveau protocole à implémenter.

Lors de la première bascule, l'accès et le renouvellement avec un ancien JWT
donnent `401` : les clients doivent terminer la session locale et proposer la
connexion habituelle. Les nouveaux JWT peuvent ensuite être renouvelés et
révoqués normalement. Les anciens liens de confirmation sont aussi invalides ;
une personne non confirmée redemande un lien via l'inscription existante avec
la même adresse. Les comptes et leurs données ne sont pas supprimés. Les
tokens opaques de réinitialisation de mot de passe ne sont pas modifiés par
cette évolution JWT.

Coordonner avec l'agent frontend la recette Web/Android : ancien accès puis
renouvellement refusés sans boucle, retour à la connexion, nouveau login,
renouvellement réussi et déconnexion. Cette PR backend ne déploie aucun client.

## Bascule et retour arrière

Ces opérations concernent une future livraison manuelle par le propriétaire.
Elles ne sont pas exécutées lors de la fusion dans `develop`.

1. Choisir une fenêtre avec reconnexion annoncée, vérifier une sauvegarde et
   sa restauration selon le [runbook](backup-recovery-runbook.md), et préparer
   les deux métadonnées dans le fichier serveur privé. Vérifier la configuration
   de l'image candidate avec la procédure [CI/CD](ci-cd.md).
2. Fermer l'accès public en maintenance et arrêter **tous** les anciens réplicas
   avant la migration. Conserver la maintenance jusqu'à la recette. Ne pas faire
   de rolling deploy ni faire cohabiter les anciens vérificateurs avec les nouveaux.
3. Lancer le wrapper manuel sur le SHA approuvé. La migration immutable
   `20261017210000_revoke_pre_issuer_audience_sessions` renseigne `revokedAt`
   et `updatedAt` pour les seules sessions encore non révoquées. Elle conserve
   les comptes, hashes, dates d'expiration et révocations déjà existantes.
   Aucune structure SQL ne change. Son application est mémorisée par Prisma :
   ne pas supprimer cet historique ni rejouer le SQL après reprise des connexions.
4. Vérifier disponibilité, connexion Web et native, renouvellement et rejet
   d'un ancien jeton dans une recette contrôlée sans publier de credentials ou
   jetons dans les logs. Vérifier qu'un second `migrate deploy` n'a rien à
   appliquer, puis rouvrir l'accès. Demander un nouveau lien de confirmation
   si nécessaire.

La révocation est volontairement irréversible : un rollback applicatif
**ne remet pas les anciennes sessions en service**. Le wrapper peut redémarrer
l'image précédente en cas d'échec ; maintenir l'accès public fermé. Avant de
rouvrir une ancienne version, renouveler les trois secrets dans la configuration
privée, révoquer aussi les sessions créées pendant la recette, puis redémarrer
et vérifier la connexion. Les anciens vérificateurs ignorent `iss`/`aud` :
le retour arrière retire cette protection et nécessite une revue de sécurité.
Ne jamais annuler des `revokedAt` ni réutiliser des secrets pour éviter la reconnexion.
Une restauration SQL doit à nouveau invalider les sessions restaurées selon
le runbook ; restaurer une sauvegarde n'est pas un moyen d'annuler cette bascule.

## Preuves et limites de validation

```bash
npm run test:security-config
npm run test:token-service
npm run test:jwt-policy
```

Avec la configuration synthétique du [guide de test](test-environment.md),
les tests couvrent émission et vérification des trois usages, options imposées,
claims absents/incorrects, mauvais secret/algorithme/expiration, callback,
accès HTTP refusé avant le traitement privé, connexion native, rotation,
rejeu et confirmation. Un refresh historique possède un payload et un hash
persisté valides dans le faux dépôt mais reste refusé avant toute rotation.
Les dépôts sont en mémoire ; aucun SMTP ou SQL distant n'est utilisé.

Le parcours MySQL jetable ajoute :

```bash
npm run test:jwt-session-migration
```

Il remet uniquement cette migration en attente dans la base de test gardée,
vérifie deux propriétaires, sessions actives/expirées/révoquées, préservation
des données et répétition sans changement, puis émission et rotation d'une
nouvelle session. Il n'exécute ni rollback de production ni recette native Android.
La CI exécute aussi les suites existantes de contrats Web/natifs, les audits
npm et les deux restaurations. Aucune vérification de production n'est déduite
de ces tests.
