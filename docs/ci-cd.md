# CI/CD Backend

## Pipeline

Les branches et merge requests executent le formatage, le lint, le type-check,
les tests avec MySQL 8, le build TypeScript et la construction de l'image.
BuildKit rootless publie l'image dans le Container Registry GitLab avec le SHA
Git complet comme tag. Aucun Docker daemon privilegie n'est expose au job.

Sur un push vers la branche protegee `main`, ou pour un pipeline lance a la
main sur `main` (« Run pipeline », source `web`, par exemple pour redeployer
le meme commit apres un changement de `backend.env`), `deploy_production`
devient disponible manuellement apres validation de toute la pipeline. Il
n'est jamais propose pour une merge request, une autre branche ou un tag. Le job SSH ne
transmet que le SHA valide. Le serveur fixe lui-meme le registre, le fichier
d'environnement et le fichier Compose autorises.

Le script serveur applique les migrations, remplace le conteneur, attend la
sonde de disponibilite et restaure l'image precedente si la sonde echoue. Les
migrations SQL ne sont pas annulees automatiquement : elles doivent rester
compatibles avec la version precedente de l'application.

Les compteurs des routes d'authentification sont partages par Redis. La
[politique de rate limiting distribue](distributed-rate-limiting.md) decrit le
modele de menace, le comportement en panne et le retour arriere.

## Runner GitLab

Tous les jobs heritent du tag `server_runner` defini dans `default.tags`, y
compris la validation, les tests, le build, la construction de l'image et la
publication des notes de release. Le deploiement conserve son tag explicite
et reste manuel. Les jobs ne ciblent plus les runners GitLab heberges sans tag.

Le runner de projet ou de groupe portant ce tag doit etre actif et disponible
pour la ref executee. Son executeur doit prendre en charge les images de jobs,
les services MySQL/Redis et BuildKit rootless. Si le runner est reserve aux
refs protegees, les branches non protegees attendront un runner compatible ;
ne pas supprimer cette protection pour debloquer une merge request. Utiliser
un runner CI isole et autorise pour ces refs si elles doivent etre executees.
Ne pas exposer les secrets de production ou le socket Docker de l'hote aux
jobs de validation.

Un retry de l'ancienne pipeline reutilise son ancienne configuration. Apres
fusion du correctif sur la branche cible, creer une nouvelle pipeline pour le
nouveau commit afin de prendre en compte le tag.

## Variables GitLab

Configurer ces variables avec la portee `production` et l'option `Protected` :

| Variable          | Type     | Usage                              |
| ----------------- | -------- | ---------------------------------- |
| `SSH_PRIVATE_KEY` | File     | Cle privee du compte `mhw-backend` |
| `SSH_KNOWN_HOSTS` | File     | Cle d'hote verifiee hors de la CI  |
| `SERVER_IP`       | Variable | Hote SSH cible                     |
| `SERVER_USER`     | Variable | `mhw-backend`                      |

Le registre utilise les variables GitLab predefinies `CI_REGISTRY*`. Aucun
secret applicatif ni jeton du registre ne doit etre stocke dans le depot.

## Preparation Unique Du Serveur

Creer un compte sans acces Docker direct :

```bash
sudo adduser --disabled-password --gecos "" mhw-backend
sudo passwd -l mhw-backend
sudo install -d -o root -g root -m 755 /opt/myhappywallet-backend
sudo install -d -o root -g root -m 700 /etc/myhappywallet-backend
sudo install -d -o root -g root -m 700 /var/lib/myhappywallet-backend
```

Installer depuis une copie locale de la release :

```bash
sudo install -o root -g root -m 644 compose.production.yml \
  /opt/myhappywallet-backend/compose.production.yml
sudo install -o root -g root -m 755 scripts/deploy-production.sh \
  /usr/local/sbin/deploy-mhw-backend
```

Creer `/etc/myhappywallet-backend/image-repository`, mode `600`, avec une seule
ligne contenant le chemin du registre sans tag :

```text
registry.gitlab.com/formation-cda1/projet-chef-oeuvre-rapport/projet-00-myhappywallet-backend
```

Creer `/etc/myhappywallet-backend/backend.env`, proprietaire `root:root`, mode
`600`. Les noms requis sont :

```dotenv
NODE_ENV=production
PORT=4201
APP_BASE_URL=/v1
API_PUBLIC_URL=https://api.myhappywallet.andriacapai.com
FRONTEND_URL=https://myhappywallet.andriacapai.com
CORS_ORIGINS=https://myhappywallet.andriacapai.com
REDIS_URL=redis://rate-limit-redis:6379
DATABASE_URL=<production-database-url>
ACCESS_TOKEN=<random-secret-at-least-32-characters>
REFRESH_TOKEN=<different-random-secret-at-least-32-characters>
REGISTER_TOKEN=<third-random-secret-at-least-32-characters>
JWT_ISSUER=https://api.myhappywallet.andriacapai.com
JWT_AUDIENCE=urn:myhappywallet:production
MAILER_DRIVER=sendgrid
SENDGRID_API_KEY=<secret>
EMAIL_SENDER=<verified-sender>
```

Les trois secrets JWT doivent etre distincts. Le wrapper de deploiement charge
la configuration depuis l'image candidate avant les migrations et interrompt
le deploiement si une valeur est absente, trop courte ou dupliquee. Il
n'affiche jamais les valeurs.

`JWT_ISSUER` et `JWT_AUDIENCE` sont aussi obligatoires en production : utiliser
des valeurs distinctes de celles du test/staging. Pour la premiere release #35,
suivre la [bascule JWT avec reconnexion](jwt-issuer-audience.md#bascule-et-retour-arrière)
avant le wrapper habituel : arreter tous les anciens replicas et maintenir
l'acces public ferme pendant la migration. Le wrapper applique une migration
de donnees qui revoque les sessions existantes ; revenir a l'image precedente
ne les reactive pas. Ne pas faire de rolling deploy pour cette bascule.

Ne pas copier le fichier `.env` dans l'image. Sur le VPS actuel, MySQL tourne
sur l'hote : utiliser `host.docker.internal` dans `DATABASE_URL`. Le reseau
Compose est fixe a `172.22.0.0/28` afin que le compte MySQL puisse etre limite
a ce seul sous-reseau. MySQL doit ecouter uniquement sur `127.0.0.1` et
`172.17.0.1`, l'adresse stable de `docker0`, jamais sur l'adresse publique.

Le compte applicatif recommande est `mhw_backend@172.22.0.0/28`, avec des
privileges limites a `myhappywallet.*`. Ne supprimer l'ancien compte autorise
depuis `%` qu'apres une connexion et un deploiement reussis avec le nouveau.

Creer un Deploy Token GitLab limite a `read_registry`, puis authentifier root
interactivement pour ne pas placer le token dans l'historique du shell :

```bash
sudo docker login registry.gitlab.com --username '<deploy-token-user>'
sudo chmod 600 /root/.docker/config.json
```

Autoriser uniquement le wrapper valide par `visudo` :

```sudoers
mhw-backend ALL=(root) NOPASSWD: /usr/local/sbin/deploy-mhw-backend *
```

Le script refuse tout argument autre qu'un SHA Git hexadecimal de 40 caracteres
et refuse tout registre hors de `registry.gitlab.com`. Le compte `mhw-backend`
ne doit appartenir ni au groupe `docker`, ni au groupe `sudo`.

## Verification

Avant le premier lancement, verifier sans afficher les secrets :

```bash
sudo test -s /etc/myhappywallet-backend/backend.env
sudo test -s /etc/myhappywallet-backend/image-repository
sudo visudo -cf /etc/sudoers.d/myhappywallet-backend
sudo -u mhw-backend sudo -n /usr/local/sbin/deploy-mhw-backend invalid || true
sudo nginx -t
```

Apres deploiement :

```bash
curl --fail https://api.myhappywallet.andriacapai.com/health/live
curl --fail https://api.myhappywallet.andriacapai.com/health/ready
sudo docker compose --project-name myhappywallet-backend \
  --file /opt/myhappywallet-backend/compose.production.yml ps
sudo cat /var/lib/myhappywallet-backend/current-image
```

Nginx continue de proxifier `127.0.0.1:4201`; aucun port du conteneur n'est
expose publiquement. Activer `Prevent outdated deployment jobs`, proteger
`main` et l'environnement `production`, et reserver le runner tague
`server_runner` aux refs protegees.

La sauvegarde chiffree, la restauration isolee, l'invalidation des sessions et
le retour arriere sont decrits dans
[backup-and-restore.md](backup-and-restore.md). Une restauration n'est jamais
declenchee automatiquement par la pipeline de deploiement.
