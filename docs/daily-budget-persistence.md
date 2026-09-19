# Persistance des périodes budgétaires

## Migration additive

La migration `20260919110000_add_budget_periods` crée `BudgetPeriod` sans
modifier ni supprimer les tables historiques `ResteAVivre` et
`ResteAVivreFictif`. Elle ajoute également l'index
`(userId, currency, operationDate, id)` aux opérations ponctuelles.

Avant la production, sauvegarder la base et vérifier :

```sql
SELECT COUNT(*) FROM Utilisateur;
SELECT COUNT(*) FROM OneOffOperationRecord;
SELECT COUNT(*) FROM ResteAVivre;
SELECT COUNT(*) FROM ResteAVivreFictif;
```

Après `npm run db:deploy`, vérifier :

```sql
SHOW CREATE TABLE BudgetPeriod;
SHOW INDEX FROM OneOffOperationRecord
  WHERE Key_name = 'OneOffOperationRecord_userId_currency_operationDate_id_idx';
SELECT COUNT(*) FROM BudgetPeriod;
```

Le dernier compteur vaut initialement zéro. Les périodes sont créées
paresseusement par le moteur; aucune ancienne ligne RaV n'est convertie sans
mois et devise fiables.

## Accès et calcul

`BudgetPeriodEngine` orchestre le calcul pur du domaine et
`PrismaBudgetPeriodRepository` limite chaque lecture au propriétaire, au mois
et à la devise. Une période courante ouverte rafraîchit son snapshot fixe
seulement lorsque les totaux changent. Une période passée ouverte est clôturée
à la première synthèse et n'est plus mise à jour.

Les opérations réelles restent les faits de référence. Le moteur charge un
intervalle d'au plus 31 jours avec l'index composite et calcule les points
journaliers en mémoire. Il ne persiste aucun total journalier.

## Compatibilité

Cette étape ne branche aucun nouvel endpoint et ne modifie pas les réponses
existantes. L'ancien backend ignore la nouvelle table. Le nouveau code conserve
les anciennes tables RaV en lecture et en écriture jusqu'à la bascule prévue par
les lots API.

## Retour arrière

Le premier retour arrière consiste à redéployer l'ancienne application; la table
additive reste inutilisée. Ne jamais supprimer la migration déjà déployée. Si la
table ou l'index doivent être retirés, vérifier d'abord qu'aucune période n'a été
créée, sauvegarder les lignes éventuelles, puis appliquer une nouvelle migration
en avant.
