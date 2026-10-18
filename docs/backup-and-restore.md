# Sauvegarde Et Restauration Des Donnees

La strategie definie par [#34](https://github.com/open-repos/cda-my-happy-wallet-backend/issues/34)
est completee par le [runbook operateur de #49](backup-recovery-runbook.md) :
planification, points de decision, diagnostics, preuve de recette et reprise.
La recette jetable se lance avec `node scripts/test-backup-recovery.cjs` dans
le contexte de test decrit dans ce runbook. Elle ne sauvegarde pas la production.

## Objectifs Et Responsabilites

Cette procedure couvre la base MySQL de production, y compris les donnees
financieres, comptes et sessions. La cible initiale est un RPO de 24 heures et
un RTO de 2 heures. Le proprietaire du service valide les restaurations; le
compte applicatif ne peut ni sauvegarder ni restaurer.

Une sauvegarde n'est valide que si elle est chiffree, copiee hors du VPS,
verifiee par checksum et restauree avec succes dans une base isolee. Conserver
14 sauvegardes quotidiennes, 8 hebdomadaires et 12 mensuelles. Tester une
restauration chaque mois et apres toute migration de schema importante.

## Modele De Menace

- Le dump contient des donnees personnelles et financieres, des mots de passe
  haches, des jetons de reinitialisation et des empreintes de refresh tokens.
- Copier les archives vers un stockage hors site avec historique immuable et
  conserver une copie de la cle dans le gestionnaire de secrets hors VPS. Le
  timer symetrique doit pouvoir lire une cle locale : les modes Unix protegent
  des comptes non autorises, mais pas d'une compromission de root sur ce VPS.
  Ne pas presenter ce montage comme une protection contre cet attaquant.
- Les noms de fichiers, journaux et alertes n'incluent ni email, ni identifiant
  utilisateur, ni contenu metier, ni secret.
- Les comptes MySQL de sauvegarde et restauration sont distincts. Le premier
  est en lecture seule; le second n'est active que pendant un exercice autorise.
- Une restauration invalide les sessions et liens temporaires afin de ne pas
  ressusciter une session revoquee apres la date du dump.

## Prerequis Du VPS

Installer `mysql-client`, `openssl`, `gzip`, `sha256sum` et `flock`. Creer un
repertoire appartenant a `root`, non servi par HTTP :

```bash
sudo install -d -o root -g root -m 700 /var/backups/myhappywallet
sudo install -d -o root -g root -m 700 /etc/myhappywallet-backend/backup
```

Creer `/etc/myhappywallet-backend/backup/client.cnf` en mode `600`. Il contient
les parametres MySQL du compte de lecture, sans argument secret dans la ligne de
commande :

```ini
[client]
host=127.0.0.1
port=3306
user=mhw_backup
password=<secret-stocke-hors-de-git>
```

Accorder uniquement `SELECT`, `SHOW VIEW`, `TRIGGER` et `EVENT` sur
`myhappywallet.*`. Le compte doit etre limite a `localhost`. Creer separement
un fichier `restore-client.cnf`, mode `600`, pour un compte autorise a creer et
alimenter uniquement des bases nommees `myhappywallet_restore_*`.

Les droits sont accordes par un administrateur MySQL, puis verifies avec
`SHOW GRANTS`; les mots de passe d'exemple sont remplaces interactivement :

```sql
CREATE USER 'mhw_backup'@'localhost' IDENTIFIED BY '<secret>';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT
  ON myhappywallet.* TO 'mhw_backup'@'localhost';

CREATE USER 'mhw_restore'@'localhost' IDENTIFIED BY '<different-secret>';
GRANT ALL PRIVILEGES
  ON `myhappywallet_restore\_%`.* TO 'mhw_restore'@'localhost';
```

Le schema applicatif versionne ne contient pas de routine stockee. Le dump
ci-dessous omet donc `--routines` : dans la documentation MySQL 8.0, cette option
demande un privilege de lecture global qui depasse le compte limite au schema.
Avant une sauvegarde, l'administrateur verifie l'absence de routines ajoutees
hors depot. S'il en existe, arreter et definir leur export et leur restauration
avec leurs privileges/definers, sans accorder silencieusement des droits globaux.
Reference : [manuel mysqldump MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html#option_mysqldump_routines).

Creer un mot de passe de chiffrement aleatoire dans
`/etc/myhappywallet-backend/backup/archive.pass`, mode `600`. Sauvegarder cette
valeur dans le gestionnaire de secrets hors du VPS. Ne jamais la placer dans
une variable de CI, un argument de processus ou un journal.

## Sauvegarde Idempotente

Executer le bloc suivant comme `root` depuis un timer systemd quotidien. Il
prend un verrou, cree une archive immutable horodatee et refuse d'ecraser un
fichier existant :

```bash
set -Eeuo pipefail
umask 077
exec 9>/run/lock/myhappywallet-backup.lock
flock -n 9 || exit 0

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="/var/backups/myhappywallet/mysql-${stamp}.sql.gz.enc"
test ! -e "$base"

mysqldump \
  --defaults-extra-file=/etc/myhappywallet-backend/backup/client.cnf \
  --single-transaction --quick --triggers --events --hex-blob \
  --set-gtid-purged=OFF --no-tablespaces myhappywallet \
| gzip -9 \
| openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
    -pass file:/etc/myhappywallet-backend/backup/archive.pass \
    -out "${base}.tmp"

test -s "${base}.tmp"
mv "${base}.tmp" "$base"
sha256sum "$base" > "${base}.sha256"
chmod 600 "$base" "${base}.sha256"
printf 'backup_completed file=%s\n' "$(basename "$base")"
```

La copie hors site commence seulement apres creation du checksum. Elle utilise
un compte dedie en ecriture seule sur la destination. La retention est appliquee
sur la copie distante apres verification, jamais avant. En cas d'echec, retirer
uniquement le fichier `.tmp`; le dump precedent reste intact.

## Verification Sans Restauration

Verifier l'integrite sans ecrire de donnees :

```bash
cd /var/backups/myhappywallet
sha256sum --check mysql-YYYYMMDDTHHMMSSZ.sql.gz.enc.sha256
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass file:/etc/myhappywallet-backend/backup/archive.pass \
  -in mysql-YYYYMMDDTHHMMSSZ.sql.gz.enc \
| gzip --test
```

Les sorties attendues sont `OK` pour le checksum et un code `0` pour `gzip`.
Ne jamais dechiffrer vers un fichier persistant pour cette verification.
Charger le checksum depuis la copie hors site de confiance : un digest stocke
a cote de l'archive detecte une corruption accidentelle, mais ne prouve pas son
authenticite si un attaquant peut remplacer les deux. Le chiffrement CBC
existant n'ajoute pas a lui seul une authentification de l'archive.

## Exercice De Restauration Isole

Choisir un nom neuf compose uniquement de chiffres pour le suffixe. Ne jamais
importer directement dans `myhappywallet` :

```bash
set -Eeuo pipefail
restore_db="myhappywallet_restore_$(date -u +%Y%m%d%H%M%S)"
[[ "$restore_db" =~ ^myhappywallet_restore_[0-9]{14}$ ]]

mysql --defaults-extra-file=/etc/myhappywallet-backend/backup/restore-client.cnf \
  -e "CREATE DATABASE \`${restore_db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass file:/etc/myhappywallet-backend/backup/archive.pass \
  -in /var/backups/myhappywallet/mysql-YYYYMMDDTHHMMSSZ.sql.gz.enc \
| gzip -dc \
| mysql --defaults-extra-file=/etc/myhappywallet-backend/backup/restore-client.cnf \
    "$restore_db"
```

Verifier ensuite sans afficher de ligne metier :

```bash
mysql --defaults-extra-file=/etc/myhappywallet-backend/backup/restore-client.cnf \
  --batch --skip-column-names "$restore_db" <<'SQL'
SELECT COUNT(*) > 0 FROM information_schema.tables
 WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations';
SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();
SQL
```

Les deux premiers resultats attendus sont `1` puis `0`. Comparer uniquement les
nombres de tables et de lignes par table avec la source; ne pas journaliser leur
contenu. Demarrer ensuite temporairement le backend avec une URL vers cette base,
executer `prisma migrate status`, les sondes `/health/live` et `/health/ready`,
puis un parcours de lecture avec un compte de recette.

L'exercice est reproductible : chaque tentative utilise un nouveau nom. En cas
d'echec, conserver les codes et etapes sans donnees, puis supprimer uniquement
la base isolee apres diagnostic :

```bash
mysql --defaults-extra-file=/etc/myhappywallet-backend/backup/restore-client.cnf \
  -e "DROP DATABASE \`${restore_db}\`"
```

## Bascule Apres Sinistre

1. Passer l'application en maintenance et bloquer les ecritures.
2. Si la source est lisible, creer une derniere sauvegarde avant intervention.
3. Restaurer dans une base neuve et effectuer tous les controles precedents.
4. Dans la base restauree, supprimer les sessions et liens temporaires :

   ```sql
   DELETE FROM RefreshSession;
   UPDATE Utilisateur SET resetToken = NULL, resetTokenExpiration = NULL;
   ```

5. Generer de nouvelles valeurs `ACCESS_TOKEN`, `REFRESH_TOKEN` et
   `REGISTER_TOKEN` dans le gestionnaire de secrets. Les anciens secrets peuvent
   etre conserves pour tracer la configuration anterieure dans un paquet chiffre,
   mais ne doivent pas etre reactives lors de la reprise.
6. Modifier `DATABASE_URL`, redemarrer avec le meme SHA applicatif, puis verifier
   les sondes, une connexion, la propriete des donnees et un calcul financier.
7. Reouvrir les ecritures. Tous les utilisateurs doivent se reconnecter.

Les migrations Prisma restent forward-only. Une sauvegarde de donnees ne sert
pas a annuler une migration pendant un deploiement ordinaire; le schema restaure
doit etre compatible avec le SHA applicatif choisi.

## Retour Arriere Avant Reouverture Des Ecritures

Conserver jusqu'a la fin de la recette l'ancienne base isolee des ecritures
applicatives et son URL dans un paquet chiffre. Si la verification post-bascule
echoue avant reouverture, rester en maintenance et revenir a cette base et au
SHA compatible. Avant de la desservir, y invalider egalement les sessions et
liens temporaires, puis configurer trois nouveaux secrets distincts. Reutiliser
ses anciennes sessions ou ses anciennes cles pourrait ressusciter des acces
revoques depuis le dump. Verifier les sondes et une nouvelle connexion avant
de rouvrir les ecritures. La candidate reste isolee pour diagnostic et n'est
supprimee que par une operation distincte autorisee.

Si des ecritures ont deja repris sur la candidate, aucun simple retour d'URL
ne garantit leur conservation : repasser en maintenance et reconcilier les
changements avec le proprietaire. Ne pas fusionner deux bases automatiquement.

Le compte rendu mensuel contient seulement : horodatage, identifiant de
l'archive, checksum valide, duree, nombre de tables, statut des migrations,
resultats des sondes, bascule/rollback et anomalies expurgees.

## Preuve Locale Versionnee

Le 18 septembre 2026, la procedure a ete executee dans le service MySQL jetable
du workspace : dump de `myhappywallet_test`, chiffrement AES-256/PBKDF2,
checksum valide, restauration dans une base `myhappywallet_restore_*`, puis
controle de 15 tables et de zero migration echouee. Les sessions et jetons
temporaires ont ete invalides dans la candidate. Le retour vers la source a ete
simule en conservant la base initiale intacte, puis la candidate, l'archive et
la cle de test ont ete supprimees. Cette preuve valide la procedure technique;
elle ne remplace pas l'exercice mensuel sur une copie de production expurgee.

Cette preuve est historique et son nombre de tables n'est pas une attente
figee pour le schema actuel. La recette de #49 compare dynamiquement les tables
et les donnees de deux copies, verifie les migrations, les proprietaires et les
sessions, puis simule une selection de base et un retour avant reouverture des
ecritures. Elle ne deploie aucun backend ; les sondes, la connexion avec les
nouvelles cles et le RTO reel restent a verifier lors de la recette operateur.
