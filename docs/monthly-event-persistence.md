# Persistance et API des événements mensuels

## Migration compatible

La migration `20260918150000_expand_monthly_events` étend la table historique
`EvenementMensuel` sans la remplacer. Elle ajoute le sens financier, la date de
début, la répétition et la date de fin. Les lignes existantes deviennent des
dépenses ponctuelles dont la date de début reprend `DATE(created_at)`.

Les nouvelles colonnes `kind` et `recurrence` ont des valeurs par défaut. Une
ancienne version du backend peut donc encore créer une ligne après la migration;
la base complète les nouveaux champs. La clé étrangère utilisateur passe à
`ON DELETE CASCADE` et l'index `(userId, startDate, id)` borne les lectures
propriétaires paginées.

Avant production, sauvegarder la base et relever :

```sql
SELECT COUNT(*) AS events_before FROM EvenementMensuel;
SELECT COUNT(*) AS events_without_owner
FROM EvenementMensuel e LEFT JOIN Utilisateur u ON u.id = e.userId
WHERE u.id IS NULL;
```

Le second compteur doit être nul. Après `npm run db:deploy`, vérifier :

```sql
SELECT COUNT(*) AS events_after FROM EvenementMensuel;
SELECT COUNT(*) AS invalid_dates FROM EvenementMensuel WHERE startDate IS NULL;
SELECT kind, recurrence, COUNT(*) FROM EvenementMensuel GROUP BY kind, recurrence;
```

Le nombre de lignes doit être inchangé et `invalid_dates` doit valoir zéro. Le
test `npm run test:monthly-events-migration` rejoue la migration sur une ligne
au format historique et vérifie le backfill ainsi que la suppression en cascade.

## Frontières applicatives

Le domaine et les cas d'usage ne dépendent ni de Prisma ni d'Express. Le
repository filtre `userId` dans chaque lecture, modification et suppression.
Une ressource d'un autre utilisateur reste indistinguable d'une ressource
absente et retourne `404`.

Les routes authentifiées sont :

- `GET/POST /events` pour les règles paginées et leur création;
- `GET/PUT/DELETE /events/{id}` pour une règle propriétaire;
- `GET /event-occurrences?month=YYYY-MM` pour les occurrences calculées et
  paginées d'un mois civil.

Les curseurs sont chiffrés, liés au propriétaire et à la ressource. Celui des
occurrences est aussi lié au mois demandé. Les DTO n'exposent jamais `userId`,
les types Prisma, le secret de curseur ou un détail SQL.

## Retour arrière

La migration est additive et conserve les noms historiques des colonnes titre,
montant et devise. Le premier retour arrière consiste à redéployer l'ancien
backend; les valeurs par défaut maintiennent ses écritures compatibles.

Ne jamais modifier une migration déjà déployée. Si les colonnes doivent être
retirées, exporter et compter d'abord les règles créées par la nouvelle API,
puis appliquer une nouvelle migration en avant. La suppression des colonnes
perdrait le sens, les dates et la récurrence : elle nécessite donc une décision
explicite et une sauvegarde vérifiée.
