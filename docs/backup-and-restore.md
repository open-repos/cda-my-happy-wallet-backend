# Sauvegarde Et Restauration Des Donnees

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
- Une lecture du VPS ne doit pas donner acces a la fois au dump chiffre et a la
  cle de dechiffrement. Copier les archives vers un stockage hors site avec
  historique immuable; conserver la cle dans le gestionnaire de secrets.
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
  --single-transaction --quick --routines --triggers --events --hex-blob \
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
   `REGISTER_TOKEN` dans le gestionnaire de secrets. Conserver les anciennes
   valeurs uniquement dans le paquet de rollback chiffre, pendant l'exercice.
6. Modifier `DATABASE_URL`, redemarrer avec le meme SHA applicatif, puis verifier
   les sondes, une connexion, la propriete des donnees et un calcul financier.
7. Reouvrir les ecritures. Tous les utilisateurs doivent se reconnecter.

Les migrations Prisma restent forward-only. Une sauvegarde de donnees ne sert
pas a annuler une migration pendant un deploiement ordinaire; le schema restaure
doit etre compatible avec le SHA applicatif choisi.

## Retour Arriere Teste

Conserver jusqu'a la fin de la recette l'ancienne base en lecture seule, son URL
et les anciens secrets dans un paquet chiffre. Si la verification post-bascule
echoue, remettre l'application en maintenance, restaurer l'ancienne
configuration, redemarrer le SHA precedent et verifier les sondes. Ne rouvrir
les ecritures qu'apres confirmation. La base candidate reste isolee pour le
diagnostic puis est supprimee par une operation distincte autorisee.

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
