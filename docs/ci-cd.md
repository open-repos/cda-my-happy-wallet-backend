# CI/CD Backend

## Pipeline

Les branches et merge requests executent le formatage, le lint, le type-check,
les tests avec MySQL 8, le build TypeScript et la construction de l'image.
BuildKit rootless publie l'image dans le Container Registry GitLab avec le SHA
Git complet comme tag. Aucun Docker daemon privilegie n'est expose au job.

Sur un push vers la branche protegee `main`, `deploy_production` devient
disponible manuellement apres validation de toute la pipeline. Le job SSH ne
transmet que le SHA valide. Le serveur fixe lui-meme le registre, le fichier
d'environnement et le fichier Compose autorises.

Le script serveur applique les migrations, remplace le conteneur, attend la
sonde de disponibilite et restaure l'image precedente si la sonde echoue. Les
migrations SQL ne sont pas annulees automatiquement : elles doivent rester
compatibles avec la version precedente de l'application.

## Variables GitLab

Configurer ces variables avec la portee `production` et l'option `Protected` :

| Variable          | Type     | Usage                                    |
| ----------------- | -------- | ---------------------------------------- |
| `SSH_PRIVATE_KEY` | File     | Cle privee du compte `mhw-backend`       |
| `SSH_KNOWN_HOSTS` | File     | Cle d'hote verifiee hors de la CI        |
| `SERVER_IP`       | Variable | Hote SSH cible                           |
| `SERVER_USER`     | Variable | `mhw-backend`                            |

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
DATABASE_URL=<production-database-url>
ACCESS_TOKEN=<secret>
REFRESH_TOKEN=<secret>
REGISTER_TOKEN=<secret>
MAILER_DRIVER=sendgrid
SENDGRID_API_KEY=<secret>
EMAIL_SENDER=<verified-sender>
```

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
sudo docker login registry.gitlab.com --username <deploy-token-user>
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
`server_runner_2` aux refs protegees.
