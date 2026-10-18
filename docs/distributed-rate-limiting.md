# Rate Limiting Distribue

## Decision

Les routes d'authentification utilisent Redis comme compteur partage entre les
repliques du backend. Chaque famille de route conserve un prefixe distinct et
une fenetre glissante geree par `express-rate-limit`/`rate-limit-redis`. Le
magasin memoire reste disponible uniquement lorsque `REDIS_URL` est absent hors
production, pour les tests unitaires isoles et le developpement minimal.

En production, l'absence de `REDIS_URL` bloque le demarrage. Une erreur du
magasin n'autorise pas la requete (`passOnStoreError: false`) et la sonde de
readiness retourne `503` lorsque Redis ne repond plus. La sonde liveness reste
independante afin que l'orchestrateur ne redemarre pas en boucle un processus
sain pendant une panne Redis.

## Modele De Menace

- Le compteur est partage par IP entre toutes les repliques, ce qui evite de
  multiplier la limite par le nombre de processus.
- Redis ne contient ni token, ni email, ni corps de requete : uniquement des
  cles derivees par le middleware, des compteurs et leur expiration.
- Le service Redis n'expose aucun port hote en production et reste sur le reseau
  Compose prive. Le conteneur est sans capability, en lecture seule, sans
  persistance et avec une memoire bornee a 64 Mio.
- Nginx reste l'unique proxy de confiance. Express accepte un seul saut proxy en
  production; exposer directement le backend permettrait de falsifier l'IP et
  reste interdit.
- Une panne Redis provoque temporairement des erreurs sur les routes protegees
  plutot qu'une levee silencieuse de la limite. Les erreurs journalisees ne
  contiennent pas l'URL Redis ni ses eventuels identifiants.

## Exploitation

`REDIS_URL=redis://rate-limit-redis:6379` suffit pour la stack Compose actuelle.
Une offre Redis externe doit utiliser `rediss://`, des identifiants places dans
le fichier d'environnement protege et des ACL limitees aux commandes exigees
par `rate-limit-redis`. La valeur ne doit jamais etre journalisee.

Verifier apres deploiement :

```bash
sudo docker compose --project-name myhappywallet-backend \
  --file /opt/myhappywallet-backend/compose.production.yml ps
curl --fail https://api.myhappywallet.andriacapai.com/health/ready
```

Un test d'integration cree deux applications Express et deux clients Redis avec
le meme prefixe. Les deux premieres requetes, reparties entre les repliques,
passent; la troisieme retourne `429`. Ce test prouve que le compteur n'est plus
local au processus.

## Retour Arriere

Revenir au SHA applicatif precedent et a son fichier Compose restaure le magasin
memoire. Cette operation reduit la protection en multi-replicas : pendant le
rollback, limiter le backend a une seule replique. Redis ne porte aucune donnee
metier et peut etre supprime apres l'arret de tous les nouveaux conteneurs.

## Baseline De Dependances

Le 18 septembre 2026, apres installation reproductible du lockfile :

- `npm audit --omit=dev` rapporte 9 vulnerabilites runtime : 1 faible,
  4 moderees et 4 hautes ;
- `npm audit` rapporte 11 vulnerabilites globales : 1 faible, 4 moderees et
  6 hautes ;
- `redis@5.8.2` et `rate-limit-redis@4.3.0` ne figurent dans aucun avis remonte.

Aucune baseline npm versionnee n'existait auparavant; ces valeurs deviennent la
reference de comparaison. Les alertes existantes concernent notamment Prisma,
Joi, Morgan, Nodemailer, Express/qs et l'outillage. Elles restent dans le lot de
mise a niveau dedie; aucun `npm audit fix` force n'est applique ici.
