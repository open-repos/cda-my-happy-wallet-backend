# Mise à jour des dépendances backend — M08-04

Issue : [#37](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/37).
La dépendance [#31](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/31)
est terminée : les contrats HTTP caractérisés servent de garde-fou. Cette
livraison corrige les alertes identifiées dans le lockfile sans migrer Express
vers 5 ni Prisma vers 7, et sans modifier le schéma ou les routes applicatives.

## Versions retenues

Les versions directes restent exactes et les transitives sont verrouillées par
`package-lock.json` ; installer avec `npm ci`, jamais avec une correction forcée
de l'audit. État vérifié le 17 octobre 2026 :

| Paquet                               | Avant   | Après   | Motif                                                             |
| ------------------------------------ | ------- | ------- | ----------------------------------------------------------------- |
| Express                              | 4.22.2  | 4.22.3  | Correction compatible de la chaîne de parsing                     |
| Joi                                  | 17.13.4 | 17.13.8 | Correctifs de validation/prototypes et de coût de traitement      |
| Morgan                               | 1.11.0  | 1.12.1  | Échappement des entrées de journal contrôlées par un client       |
| Nodemailer                           | 9.0.3   | 10.1.2  | Correctifs SMTP, parsing d'adresses et isolation des transports   |
| Axios via SendGrid                   | 1.18.1  | 1.20.0  | Correctifs des requêtes sortantes, redirections et parsing        |
| ip-address via express-rate-limit    | 10.4.0  | 10.7.4  | Classification IPv6 et limites de traitement                      |
| proxy-addr via Express               | 2.0.7   | 2.0.8   | Correction de l'alerte critique d'usurpation d'adresse            |
| body-parser via Express              | 1.20.6  | 1.20.8  | Chaîne de parsing mise à jour                                     |
| qs                                   | 6.15.3  | 6.16.1  | Correctifs du parsing des query/corps URL-encodés                 |
| deepmerge-ts via @prisma/config      | 7.1.5   | 8.0.2   | Protection des graphes récursifs, surcharge explicitée ci-dessous |
| Nodemon et sa chaîne chokidar/braces | 3.1.14  | Retirés | Remplacés par le watcher natif Node 22                            |
| @types/nodemailer                    | 6.4.24  | Retiré  | Déclarations fournies par Nodemailer 10                           |

Les autres dépendances directes et les versions du client/CLI Prisma
`6.19.3` restent inchangées. Les mises à jour transitives restent dans les
plages acceptées par leurs parents, sauf les surcharges Prisma et `minimatch`
décrites ci-dessous.
Les propositions Dependabot visant `main` ne sont pas fusionnées par cette PR.

## Compatibilité à surveiller

### Nodemailer 10

La [version 10](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md)
demande Node >= 20 et fournit des entrées CommonJS et des types intégrés.
Le backend utilise déjà Node 22. Il envoie du HTML par transport SMTP non poolé
avec `host`, `port`, `secure` ; les changements de pool ne sont donc pas utilisés.
Le code de l'adaptateur et ses erreurs publiques sont conservés. Le test ajoute
un vrai échange SMTP local, puis un refus de destinataire assaini.

### Surcharge limitée à la configuration Prisma

Le parent `@prisma/config@6.19.3` impose encore `deepmerge-ts@7.1.5`. La
correction est appliquée uniquement à ce parent :

```json
{
  "overrides": {
    "@prisma/config@6.19.3": { "deepmerge-ts": "8.0.2" }
  }
}
```

Il s'agit volontairement d'une version majeure transitive hors de la version
déclarée par ce parent. [deepmerge-ts 8](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)
modifie notamment la fusion des valeurs de `Map` et certaines API de fusion
en place. Le consommateur Prisma installé charge `deepmerge` pour la lecture
de configuration via c12 ; la configuration de ce dépôt n'utilise ni `Map`,
ni ces API de fusion en place. La recette charge une configuration imbriquée
réelle, lance `prisma validate --config`, vérifie une fusion cyclique puis la
CI génère le client et exécute les migrations/tests MySQL.

Cette surcharge n'est pas une annonce de compatibilité universelle avec toutes
les configurations Prisma. Lors d'une évolution du CLI ou d'un ajout de
configuration personnalisée, revoir les appels consommés, rejouer la recette
et retirer l'override dès qu'une version du parent déclare le correctif. Ne pas
la transformer en override global ni masquer une régression par un test allégé.

### Développement sans Nodemon

`npm run dev` exécute désormais `node --watch dist/index.js`. Le
[watcher natif est stable depuis Node 22](https://nodejs.org/download/release/v22.13.0/docs/api/cli.html#--watch).
Il suit le point d'entrée et ses modules chargés. Il ne promet pas de surveiller
tous les fichiers arbitraires du dépôt comme un watcher de répertoire.

```bash
npm run build
```

Puis, dans deux terminaux avec la configuration locale habituelle :

```bash
npm run watch
```

```bash
npm run dev
```

Le premier recompile TypeScript ; le second redémarre sur les modules compilés.
`npm start` et le lancement de production ne changent pas. Le test modifie une
dépendance CommonJS synthétique, observe le redémarrage et arrête tout le groupe
de processus avant nettoyage. Aucune version ancienne de Nodemon n'est installée
pour satisfaire une proposition de downgrade de l'audit.

## Modèle de menace et limites de confiance

| Entrée / frontière        | Exposition et protection                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP, query et formulaire | Entrées externes contrôlées par le client ; parsing qs/Joi corrigé. Limites de corps, validation et erreurs existantes vérifiées par les suites HTTP.                                                                                                                                     |
| Adresse IP et proxy       | Express fait confiance à un seul saut en production. Le correctif proxy-addr ne remplace pas le proxy frontal et la protection contre l'accès direct au backend ; les tests de débit/CORS restent nécessaires.                                                                            |
| Courriel SMTP / SendGrid  | Adresses issues des parcours validés, configuration serveur de confiance. Le SDK SendGrid a été remplacé le 28 octobre par le transport HTTP natif décrit ci-dessous. Les tests utilisent exclusivement localhost, un proxy désactivé, des délais bornés et des credentials synthétiques. |
| Configuration Prisma      | Code de release/administration de confiance, pas corps HTTP utilisateur. L'override réduit le risque de récursion ; il ne rend pas sûr le chargement d'un fichier de configuration non fiable.                                                                                            |
| Watcher de développement  | Modules compilés du poste de développement, jamais un chemin fourni par l'API. Suppression de la chaîne de glob vulnérable, sans ajout de paquet.                                                                                                                                         |
| Installation et secrets   | Lockfile versionné et `npm ci` ; aucun token de registre, fichier d'environnement peuplé ou identifiant réel dans les preuves. Aucun accès SMTP/SendGrid distant pendant les tests.                                                                                                       |

## Baseline et nouvelle mesure d'audit

Les deux états sont mesurés le même jour contre la même source npm, avant et
après modification du lockfile. Les totaux npm comptent aussi les paquets
affectés par une dépendance vulnérable ; ce ne sont pas des CVE indépendantes.

| Audit                         | Avant, 17 octobre 2026                | Après |
| ----------------------------- | ------------------------------------- | ----- |
| `npm audit --omit=dev --json` | 12 : 5 modérées, 6 hautes, 1 critique | 0     |
| `npm audit --json`            | 15 : 5 modérées, 9 hautes, 1 critique | 0     |

La [baseline du 18 septembre](development-toolchain-security.md) reste historique.
De nouveaux avis expliquent les chiffres initiaux supérieurs ; elle n'est pas
réécrite pour faire disparaître les alertes. La mesure à zéro décrit la base
d'avis consultée à cette date, pas une garantie permanente ni un audit du code.
Reproduire après installation propre et distinguer erreur réseau d'un résultat
sans vulnérabilité :

```bash
npm ci
npm audit --omit=dev --json
npm audit --json
npm explain axios ip-address proxy-addr deepmerge-ts
```

Les deux audits doivent retourner le code `0` et `metadata.vulnerabilities.total`
égal à `0`. Ne pas utiliser `|| true` pour déclarer une réussite. Les avis
d'origine sont accessibles dans les rapports npm, notamment
[proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[deepmerge-ts](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx),
[Joi](https://github.com/advisories/GHSA-6h2x-m376-mqjq) et les
[avis Nodemailer](https://github.com/nodemailer/nodemailer/security/advisories).

## Contrôle bloquant en CI

[#92](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/92)
ajoute deux étapes après `npm ci` dans
[Backend quality](../.github/workflows/backend-quality.yml) :

```bash
npm audit --omit=dev --audit-level=low
npm audit --include=dev --audit-level=low
```

Le premier contrôle les dépendances de production ; le second inclut
explicitement celles de développement. Le
[seuil npm](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
fait échouer la commande dès une alerte faible, modérée, haute ou critique.
Ces audits consultent le registre et ne corrigent pas les versions. La sortie
attendue sur le lockfile corrigé est `found 0 vulnerabilities`, code `0`.

Les étapes sont bloquantes dans le check existant
`Backend format, lint, migrations, tests and build`, sur les PR et les push
vers `develop` et `main`. Elles n'ajoutent ni permission, secret, calendrier,
ni déploiement. La protection du merge dépend toujours des
[réglages de branche](delivery-automation.md#required-repository-settings)
qui doivent exiger ce check. L'audit implicite de `npm ci` ne remplace pas
ces étapes explicites.

Si une étape échoue :

1. Distinguer un rapport de vulnérabilité d'une erreur de registre/réseau.
   Une commande interrompue n'est pas une preuve d'absence d'alertes. Pour une
   panne transitoire, rétablir l'accès puis relancer les contrôles du même commit.
2. Pour une alerte, reproduire avec `npm ci` puis les deux commandes ci-dessus.
   Obtenir le détail avec `npm audit --include=dev --json` et suivre la chaîne
   du paquet avec `npm explain <paquet>` ; ne pas publier de configuration
   d'authentification au registre dans les preuves.
3. Préparer une correction ciblée dans une PR, vérifier la compatibilité et
   rejouer les suites complètes, notamment `test:runtime-dependencies` pour la
   surcharge Prisma. Si aucun correctif n'existe, documenter le blocage dans
   une issue et garder le contrôle en échec jusqu'à une solution revue.

Ne pas utiliser `npm audit fix --force`, ignorer le code de sortie ou relever
le seuil pour rendre un résultat vert. Les rapports peuvent évoluer à lockfile
constant quand le registre publie un avis ; ils ne couvrent ni le code applicatif,
ni le frontend, ni les paquets système de l'image. Ils ne vérifient pas les
signatures des paquets et ne constituent pas une surveillance entre deux runs.

Un retour arrière de #92 rétablit uniquement le workflow et les deux guides
par un commit de revert revu. Il retire la protection CI, sans changer les
versions corrigées par #37 ; les audits manuels restent nécessaires.

## Validation et retour arrière

```bash
npm run prisma:generate
npm run format
npm run lint
npm run type-check
npm run test:runtime-dependencies
npm run build
```

La nouvelle suite couvre le consommateur Prisma réel, le watcher, le protocole
SMTP et le transport SendGrid natif via un serveur HTTP local, y compris les erreurs
assainies. Elle ne contacte pas les services de production. Suivre ensuite
[l'environnement de test](test-environment.md) : toutes les suites API, MySQL,
Redis et les deux exercices de sauvegarde/restauration restent exigés en CI.
Aucun test dédié ne se contente d'affirmer un numéro de version installé.

En cas d'incompatibilité, revenir ensemble sur `package.json`, son lockfile,
les tests/scripts et documents de cette PR puis refaire `npm ci`. Le retour
arrière remet les versions et leurs alertes précédentes : privilégier une
correction en avant lorsque possible. Aucune migration SQL ni configuration
JWT ne change ; aucun déploiement n'est déclenché par ce travail.

## Correction SendGrid du 28 octobre 2026

L'avis [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
(CVE-2026-93753) signale un empoisonnement du prototype du résultat de
`deepmerge`. La version publiée `4.3.1` reste affectée ; les versions publiées
de `@sendgrid/mail` et `@sendgrid/helpers` n'offrent pas de chemin corrigé à
cette date. La nouvelle mesure avant correction donne quatre entrées faibles
pour cette même chaîne transitive, dans les deux audits. La baseline du
17 octobre ci-dessus demeure historique.

L'application utilise uniquement l'envoi HTML simple. `SendGridMailer` appelle
maintenant directement l'[API Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send)
avec `fetch` natif de Node 22. Le SDK et ses dépendances inutilisées, dont
`deepmerge` et Axios, sont retirés du lockfile. La surcharge **distincte**
`deepmerge-ts` de Prisma reste inchangée.

Le fournisseur, `MAILER_DRIVER`, `SENDGRID_API_KEY`, `EMAIL_SENDER`, le choix
par défaut en production et les contrats de `IMailer` restent identiques.
Le corps JSON contient le destinataire, l'expéditeur, le sujet, le HTML et les
réglages de suivi existants (activés en production, désactivés ailleurs).
Seul HTTP 202 retourne `true` ; une autre réponse 2xx retourne `false` comme
auparavant. Les refus, erreurs réseau, redirections et délais expirés exposent
uniquement `SendEmaillError` / `Email was not sent`.

L'URL HTTPS est fixe, les redirections sont refusées, le délai est de dix
secondes et aucun nouvel essai automatique ne risque de doubler un envoi.
Le corps de réponse est libéré sans être analysé ni journalisé. Une
configuration vide échoue localement. L'injection du transport et du délai
est réservée au code des tests ; aucune variable ne permet de rediriger le
fournisseur en production.

`npm run test:mailer` et `npm run test:runtime-dependencies` exercent le même
adaptateur avec un vrai serveur HTTP sur loopback, des identifiants
synthétiques, les deux politiques de suivi, les statuts 202/200/4xx/5xx,
les redirections 302/307 vers un second serveur (zéro requête reçue), les
échecs réseau et un délai expiré. Aucun courriel réel n'est envoyé.
Les audits doivent toujours être exécutés après `npm ci`, sans abaisser leur
seuil ni utiliser `npm audit fix --force`. Cette correction ne nécessite
aucune migration SQL ni nouvelle configuration.

## Surcharge `minimatch` du 31 octobre 2026

L'avis [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
couvre `minimatch` avant 11.0.1, sans correctif 10.x, alors que les parents
déclarent `^10` ([#147](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/147)).
La version 11.0.3 est donc imposée à `eslint`, `@eslint/config-array` et
`@typescript-eslint/typescript-estree`, uniquement en développement. La surcharge
reste limitée à ces parents pour ne pas toucher une future dépendance.

La version 11 retire notamment `makeRe` et `AST`. Ces parents consomment
`Minimatch`, `.match()`, `.pattern` et `minimatch()`, qui restent disponibles.
ESLint analyse les mêmes 243 fichiers avant et après la surcharge, sans erreur.
Retirer chaque entrée dès que le parent concerné déclare une version corrigée.

## Joi 17.13.9 du 31 octobre 2026

L'avis [GHSA-4528-x5fx-h6hg](https://github.com/advisories/GHSA-4528-x5fx-h6hg)
concerne `string().email({ multiple: true })`, une option que les validateurs
n'utilisent pas ([#148](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/148)).
Joi passe de 17.13.8 à 17.13.9 sans changement de validateur ni de contrat d'API.
