# Runbook de sauvegarde, restauration et reprise

Issue : [backend #49 / M11-05](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/49).
Dependance : [#34](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/34),
livree par [PR #58](https://github.com/open-repos/cda-my-happy-wallet-backend/pull/58).
La [strategie de sauvegarde](backup-and-restore.md) definit les comptes, le dump,
le chiffrement, l'import et l'invalidation des sessions. Ce runbook transforme
ces blocs en un parcours operateur. Aucune installation, copie hors site ou
intervention de production n'est executee par la PR documentaire.

## Responsabilites et points d'arret

| Etape                        | Responsable et autorisation             | Condition pour poursuivre                                                                        |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Preparation et planification | Proprietaire / administrateur du VPS    | Comptes limites et fichiers root controles ; destination hors site et cle de reprise disponibles |
| Sauvegarde quotidienne       | Timer limite a la sauvegarde            | Archive chiffree non vide, checksum et copie distante verifies                                   |
| Exercice mensuel             | Operateur autorise sur une cible isolee | Archive de confiance, schema neuf, aucune application publique connectee                         |
| Bascule apres sinistre       | Decision explicite du proprietaire      | Maintenance, perte maximale connue, schema/SHA compatibles, controles reussis                    |
| Reouverture des ecritures    | Proprietaire apres recette              | Sessions invalidees, nouvelles cles, sondes et parcours de recette reussis                       |

Les objectifs sont RPO <= 24 h et RTO <= 2 h, pas une garantie mesuree par la
CI. Calculer le RPO depuis la derniere sauvegarde hors site restauree/verifiee,
et le RTO entre debut de maintenance et validation de reprise. Alerter si une
execution echoue ou si aucune copie exploitable de moins de 24 h n'est connue.
Ne jamais inscrire une recette non executee comme reussie.

## 1. Preparer une execution quotidienne

1. Suivre les [prerequis](backup-and-restore.md#prerequis-du-vps) : client MySQL
   8 compatible avec le serveur, OpenSSL, gzip, sha256sum, flock ; repertoire
   hors HTTP et fichiers de comptes/cle en `600`, dossiers en `700`.
2. L'administrateur verifie `SHOW GRANTS` sans exporter les secrets : sauvegarde
   en lecture du seul schema, restauration sur `myhappywallet_restore_*` ;
   aucun de ces comptes n'est le compte applicatif. Confirmer l'absence de
   routines stockees ajoutees hors du schema versionne, car elles necessitent
   une procedure d'export supplementaire.
3. Confirmer la copie de la cle dans le gestionnaire hors VPS et la destination
   distante protegee. Une sauvegarde locale seule ne remplit pas le besoin de
   reprise apres perte du VPS. La copie hors site et la retention ne sont pas
   automatisees par ce depot : configurer un outil adapte au stockage choisi,
   avec compte limite et confirmation de transfert avant purge distante.
4. Creer avec `sudoedit /usr/local/sbin/mhw-backup` un script contenant le bloc
   complet [Sauvegarde idempotente](backup-and-restore.md#sauvegarde-idempotente),
   precede de `#!/usr/bin/env bash`. Ne pas activer `set -x`.

Verifier avant de programmer :

```bash
sudo chown root:root /usr/local/sbin/mhw-backup
sudo chmod 700 /usr/local/sbin/mhw-backup
sudo bash -n /usr/local/sbin/mhw-backup
sudo test -s /etc/myhappywallet-backend/backup/client.cnf
sudo test -s /etc/myhappywallet-backend/backup/archive.pass
sudo stat -c '%a %U:%G %n' \
  /usr/local/sbin/mhw-backup \
  /etc/myhappywallet-backend/backup/client.cnf \
  /etc/myhappywallet-backend/backup/archive.pass
```

Attendre `700 root:root` pour le script, `600 root:root` pour les deux fichiers
et le code `0` de `bash -n`. Ne pas faire `cat` des fichiers de credentials.

Exemple de service `/etc/systemd/system/myhappywallet-backup.service`, a creer
avec `sudoedit` apres autorisation d'installation :

```ini
[Unit]
Description=My Happy Wallet encrypted MySQL backup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/local/sbin/mhw-backup
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/backups/myhappywallet /run/lock
```

Exemple de timer `/etc/systemd/system/myhappywallet-backup.timer` :

```ini
[Unit]
Description=Daily My Happy Wallet backup

[Timer]
OnCalendar=*-*-* 02:15:00 UTC
Persistent=true
Unit=myhappywallet-backup.service

[Install]
WantedBy=timers.target
```

Verifier puis activer uniquement ces unites :

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/myhappywallet-backup.service \
  /etc/systemd/system/myhappywallet-backup.timer
sudo systemctl daemon-reload
sudo systemctl start myhappywallet-backup.service
sudo systemctl status myhappywallet-backup.service --no-pager
sudo systemctl enable --now myhappywallet-backup.timer
sudo systemctl list-timers myhappywallet-backup.timer --all --no-pager
```

La premiere execution doit terminer sans erreur et produire
`backup_completed file=mysql-<horodatage-UTC>.sql.gz.enc`. Le verrou evite les
executions simultanees ; chaque execution sans verrou occupe cree une nouvelle
archive, sans ecraser une precedente. La table de retention de la strategie
porte sur 14 points quotidiens, 8 hebdomadaires et 12 mensuels verifies hors
site, pas sur une suppression aveugle de fichiers locaux.

Une reexecution de `enable --now` est sans effet destructeur. Pour annuler
la planification : `sudo systemctl disable --now myhappywallet-backup.timer`.
Cela ne stoppe pas une sauvegarde deja en cours ; attendre sa fin, conserver
les archives et la cle. L'echec d'une sauvegarde ne declenche jamais une
restauration automatique.

## 2. Verifier une archive avant tout import

Recuperer ensemble une archive et son checksum depuis la destination de
confiance ; consigner seulement leur identifiant technique. Suivre la section
[Verification sans restauration](backup-and-restore.md#verification-sans-restauration).
Attendre checksum `OK`, dechiffrement et test gzip avec code `0`. En cas de
desaccord, ne pas importer et ne pas regenerer un checksum pour faire accepter
une archive douteuse ; conserver la copie distante originale pour diagnostic.

Le SHA applicatif associe, la version MySQL/client, l'etat des migrations et
l'heure de capture doivent figurer dans le compte rendu. Ne pas mettre dump
SQL, cle, URL de base ou lignes financieres dans Git, les logs CI ou un ticket.

## 3. Restaurer et decider de la reprise

Suivre l'[exercice isole](backup-and-restore.md#exercice-de-restauration-isole)
avec une base neuve du prefixe autorise ; un nom existant doit faire echouer
`CREATE DATABASE`, jamais etre vide au prealable. Le dump d'un schema unique
ne doit contenir ni `CREATE DATABASE` ni `USE` qui redirigerait l'import vers
la source. Ne pas remplacer ce dump par un export `--databases`/`--all-databases`.

Comparer les tables, le nombre exact de lignes par table et l'etat des
migrations avec les metadonnees capturees au moment de la sauvegarde. La source
peut avoir change depuis : ne pas prendre ses comptes actuels comme preuve
que le dump d'hier est identique. La verification rapide de nombre de tables
ne suffit pas a prouver les montants, relations ou contraintes de propriete.

Pour la candidate, avec un secret local protege et le meme SHA applicatif,
verifier le statut Prisma sans appliquer de migration implicitement :

```bash
npx --no-install prisma migrate status
```

`DATABASE_URL` doit deja pointer uniquement sur cette candidate. Attendre un
schema a jour et aucune migration en echec ; sinon arreter et choisir une
version applicative compatible. Ne pas modifier une migration historique et
ne pas executer `migrate reset` pour corriger la production.

Le backend de recette doit etre prive, sans envoi de mail reel, et utiliser
ses propres secrets et services. Avant reouverture :

- suivre l'[invalidation des sessions et liens](backup-and-restore.md#bascule-apres-sinistre)
  et creer trois nouvelles cles distinctes ; une rotation invalide aussi les
  anciens curseurs, dont le client doit reprendre la premiere page ;
- verifier liveness `200` et readiness `200`, puis une nouvelle connexion ;
- lire les donnees d'un compte de recette, verifier l'absence d'acces a celles
  d'un autre compte et un calcul de budget connu ;
- faire valider le RPO mesure, les eventuelles pertes et la reprise par le
  proprietaire. Les migrations sont forward-only et ne sont pas annulees par
  un retour d'image.

Le [retour arriere](backup-and-restore.md#retour-arriere-avant-reouverture-des-ecritures)
ne revient a la source que tant que les ecritures n'ont pas repris. Il invalide
aussi les sessions de la base reprise et conserve de nouvelles cles. Apres
reouverture, une reconciliation est obligatoire avant toute nouvelle bascule.

## 4. Recette automatisee sur MySQL jetable

Le [script de recette](../scripts/test-backup-recovery.cjs) est execute **deux
fois** par [Backend quality](../.github/workflows/backend-quality.yml), apres
les suites API et avant le build. Ce n'est pas un outil de sauvegarde de
production : mot de passe root de test fixe, conteneur `mysql:8.0` avec
`MYSQL_DATABASE=myhappywallet_test`, `NODE_ENV=test` et URL de base de test
obligatoires. Toute autre configuration est refusee avant une requete SQL.

Depuis le [parcours Docker de test](test-environment.md), garder MySQL et les
exports de test, puis executer sur la machine qui controle Docker :

```bash
export BACKUP_DRILL_MYSQL_CONTAINER=mhw-docs-mysql-test
node scripts/test-backup-recovery.cjs
node scripts/test-backup-recovery.cjs
unset BACKUP_DRILL_MYSQL_CONTAINER
```

Node 22, Docker, OpenSSL et gzip sont necessaires sur cette machine. L'URL de
base du guide conserve l'alias `my-happy-wallet-mysql-test` ; le script execute
les clients SQL dans le conteneur plutot que se connecter a cet alias depuis
l'hote. Aucun client SQL local, nouvelle dependance npm ou service distant
n'est necessaire.

La recette lit la base de test deja migree mais n'y ecrit pas. Elle cree deux
copies avec un nom aleatoire sous `myhappywallet_test_drill_*`, injecte des
fixtures synthetiques uniquement dans la premiere, puis :

1. Exporte le schema courant avec ses donnees, compresse et chiffre selon
   AES-256-CBC / PBKDF2 200 000 iterations ; cle en fichier temporaire `600`.
2. Verifie le checksum, le contenu dechiffre et gzip ; refuse une mauvaise cle
   et une archive alteree avant import.
3. Importe dans la seconde copie, compare toutes les donnees par empreinte
   d'un export ordonne, les tables et les migrations sans imprimer les lignes.
4. Verifie les dates, montants decimaux, icones et relations de deux
   proprietaires ; une insertion avec categorie d'un autre compte doit echouer.
5. Invalide les sessions et liens dans la copie restauree, simule sa selection
   puis un retour a la premiere copie apres la meme invalidation.
6. Verifie que la base initiale est intacte, puis supprime uniquement les deux
   schemas crees par cette execution, l'archive, le checksum et les cles.

Sortie attendue, avec un nombre de tables calcule sur le schema courant :

```text
backup_drill_passed tables=<nombre> migrations_failed=0 archive=verified corruption=refused sessions=invalidated rollback=simulated
```

Le code `0` des deux passages prouve la repetabilite sans reutiliser un schema
existant. Une assertion manquante ou une etape en echec bloque la CI. Les donnees
SQL ne sont gardees qu'en memoire pendant cette petite recette (limite 32 Mio),
jamais dans un dump clair sur disque. Cette contrainte ne convient pas aux
sauvegardes de production volumineuses, qui utilisent le pipeline de la strategie.

Sans Docker, le controle de chiffrement seul est executable localement :

```bash
NODE_ENV=test node scripts/test-backup-recovery.cjs --crypto-only
```

Attendre `backup_crypto_passed` et code `0`. Ce mode ne prouve ni l'import SQL,
ni les privileges, ni le retour arriere. Le test complet utilise root seulement
dans le conteneur jetable ; il ne certifie pas les grants reels du VPS, le
stockage hors site, la rotation effective des cles, les sondes d'un backend
redeploye ou le RTO sur un volume de production. Ces points restent dans la
recette operateur. En cas d'arret brutal du processus, recreer les conteneurs
jetables du guide plutot que nettoyer des schemas au hasard.

## Diagnostics et compte rendu

| Echec                                      | Decision et reprise                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pas d'archive ou service systemd en echec  | Examiner le code du service, l'espace disque et les droits des fichiers, sans publier leur contenu ; conserver la derniere copie valide. |
| Verrou occupe                              | Verifier si une sauvegarde tourne ; ne pas supprimer le verrou pour lancer une seconde execution.                                        |
| Checksum, cle ou gzip refuse               | Aucun import ; reprendre l'archive et la cle de confiance, diagnostiquer transfert/corruption.                                           |
| Base candidate deja existante              | Utiliser un nouveau nom ; ne jamais vider la candidate ou la source automatiquement.                                                     |
| Migrations, tables ou montants incoherents | Garder maintenance et source intactes ; choisir un dump/SHA compatible, aucune migration destructive improvisée.                         |
| Sessions encore actives apres restauration | Ne pas exposer la candidate ; executer l'invalidation et renouveler les trois cles avant recette.                                        |
| Sondes ou parcours de reprise en echec     | Avant reouverture, revenir selon la procedure ; apres reouverture, analyser les nouvelles ecritures avant bascule.                       |
| `backup_drill_failed step=guard_*`         | Configuration hors du perimetre jetable ; corriger l'environnement de test sans desactiver le garde-fou.                                 |
| `backup_drill_failed` sur une autre etape  | Les logs donnent seulement le nom de l'etape ; reproduire dans une stack jetable neuve, sans afficher les dumps/cles.                    |

Compte rendu a remplir, sans donnees utilisateur :

| Champ                                      | Valeur attendue                                    |
| ------------------------------------------ | -------------------------------------------------- |
| Date UTC, operateur, autorisation          | References de l'exercice                           |
| Archive, SHA applicatif, MySQL/client      | Identifiants techniques, jamais URL/secret         |
| Checksum et test gzip                      | OK / echec                                         |
| Tables, comptes de lignes, migrations      | Concordance avec le manifeste de capture           |
| Sessions/liens invalides et nouvelles cles | Verification faite, sans valeur de cle             |
| Sondes, connexion, propriete, budget       | Resultat de chaque controle                        |
| RPO, RTO et decision de reprise            | Durees mesurees et validation du proprietaire      |
| Retour arriere et nettoyage                | Resultats observes, limites et anomalies expurgees |

Cette table relie la preuve technique a #49 et a la decision de #34. Les anciens
liens `agent-workspace/...` de migration ne sont pas un prerequis accessible ;
les [decisions et contrats locaux](architecture.md) et ce compte rendu forment
les references du clone autonome.
