# Securite Du Toolchain De Developpement

## Perimetre

ESLint, son parseur TypeScript et Nodemon sont des outils de developpement. Ils
ne sont pas copies dans l'image d'execution finale du backend. Leur surface de
confiance reste toutefois importante : ils analysent le depot et s'executent
dans les postes de developpement et la CI, ou une dependance compromise pourrait
lire ou modifier le checkout et les variables accessibles au processus.

Le projet utilise Node.js 22. ESLint 10 exige au minimum Node.js 22.13 dans
cette branche de Node. La CI et les images Docker utilisent la derniere version
disponible de Node.js 22 et satisfont cette contrainte.

## Migration

- ESLint passe de 8.57.1 a 10.10.0.
- `@typescript-eslint/parser` passe de 8.64.0 a 8.70.0 et reste compatible avec
  TypeScript 5.9.
- `globals` explicite l'environnement Node auparavant fourni par `env.node`.
- Nodemon reste sur sa version courante 3.1.14. Le lockfile regenere remplace
  ses dependances transitives vulnerables sans introduire de version majeure
  fictive du paquet direct.
- La configuration historique `.eslintrc.json` est remplacee par le flat config
  `eslint.config.js` exige par ESLint 10. Le perimetre reste `src/**/*.ts`, sans
  nouvelle regle ni changement fonctionnel.

Une installation doit utiliser `npm ci` afin de conserver exactement l'arbre
verrouille et audite. Ne jamais appliquer `npm audit fix --force` sans analyser
les changements de versions et executer la validation complete.

## Comparaison Des Audits

Mesures realisees le 18 septembre 2026 avec le registre npm et le lockfile de
chaque etat :

| Audit                  | Avant                               | Apres                              |
| ---------------------- | ----------------------------------- | ---------------------------------- |
| `npm audit --omit=dev` | 9 (1 faible, 4 moderees, 4 hautes)  | 9 (1 faible, 4 moderees, 4 hautes) |
| `npm audit`            | 11 (1 faible, 4 moderees, 6 hautes) | 9 (1 faible, 4 moderees, 4 hautes) |

Les deux alertes hautes propres au toolchain disparaissent avec les anciennes
versions transitives de `brace-expansion` et `js-yaml`. Les neuf alertes
restantes appartiennent aux dependances d'execution, notamment Prisma, Express,
Joi, Morgan et Nodemailer. Leur correction sort de cette migration du toolchain
et doit conserver des tests fonctionnels et de securite dedies.

## Verification Et Retour Arriere

La validation exige une installation propre, le formatage, le lint, le
type-check, toutes les suites backend et le build. Le lint doit analyser au
moins un fichier TypeScript; une execution reussie sur une selection vide ne
constitue pas une validation.

En cas d'incompatibilite de la CI, revenir ensemble sur `package.json`, le
lockfile et `eslint.config.js`. Restaurer seulement `.eslintrc.json` laisserait
ESLint 10 sans configuration utilisable.
