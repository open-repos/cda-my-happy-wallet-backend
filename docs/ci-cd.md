# CI/CD Backend

## Pipeline

Les branches et merge requests executent le formatage, le lint, le type-check,
les tests de caracterisation et le build. Le deploiement est disponible
manuellement uniquement apres un pipeline vert sur la branche protegee `main`.

Le job de tests demarre un service MySQL 8 jetable, applique les migrations et
execute les tests repositories avec des identifiants factices. Cette base n'est
ni exposee sur un port hote ni conservee apres le job.

Le deploiement PM2 utilise le SHA exact valide par le pipeline. Le premier
deploiement doit etre initialise manuellement avec `pm2 deploy ... setup` sur
un poste d'administration autorise.

## Variables GitLab

Configurer ces variables avec la portee d'environnement `production` et
l'option `Protected` :

| Variable          | Type     | Usage                                     |
| ----------------- | -------- | ----------------------------------------- |
| `SSH_PRIVATE_KEY` | File     | Cle privee dediee au deploiement          |
| `SSH_KNOWN_HOSTS` | File     | Cle d'hote verifiee du serveur            |
| `SERVER_IP`       | Variable | Hote SSH cible                            |
| `SERVER_USER`     | Variable | Compte de deploiement sans privilege root |
| `DEPLOY_PATH`     | Variable | Repertoire PM2 de production              |

La cle publique correspondante doit etre limitee au compte de deploiement. Ne
pas produire `SSH_KNOWN_HOSTS` dans le job avec `ssh-keyscan` : verifier
l'empreinte du serveur hors CI avant d'enregistrer la variable.

## Reglages GitLab

- Proteger la branche `main`.
- Proteger l'environnement `production` si l'offre GitLab le permet.
- Activer `Prevent outdated deployment jobs`.
- Configurer le runner `server_runner` pour les jobs tags uniquement et les
  refs protegees.
- Conserver les jobs de validation sur les runners GitLab ou sur un runner CI
  isole du serveur de production.

Node 16 reste temporairement utilise pour compatibilite avec Prisma 3.10. Sa
migration doit etre traitee dans une tache de dependances distincte.
