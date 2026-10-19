# Prévisionnel et résolutions d'occurrences

## Statut

- Work Item : `M05-03`
- Contrat de domaine : `docs/daily-budget-domain.md`
- Décision produit du 11 octobre 2026 : l'épargne prévue des objectifs réduit
  le prévisionnel dans une ligne distincte
- API publique : `M05-04`

## Prévisionnel du mois courant

`BudgetPeriodEngine.summarize` renvoie désormais, à côté du reste réel, un
objet `forecast` pour le mois courant et `null` pour un mois passé :

```text
reste prévisionnel =
  reste réel
  + entrées planifiées non résolues du mois
  - dépenses planifiées non résolues du mois
  - épargne prévue des objectifs
disponible prudent/jour = reste prévisionnel / jours restants
```

- Une occurrence non résolue participe au mois de sa date, même passée; elle
  est alors comptée dans `overdueCount`.
- L'épargne prévue additionne les versements mensuels des objectifs non
  atteints (`savedAmount < targetAmount`) de la même devise. Elle est réservée
  dès le premier jour de la série journalière.
- Chaque point journalier donne le reste prévisionnel en fin de journée, après
  les occurrences du jour; le dernier point vaut le total mensuel.
- Le reste réel n'intègre jamais une prévision : une occurrence réalisée sort
  du prévisionnel au moment où son opération entre dans le réel.

Les occurrences sont agrégées en SQL par date et sens, soit au plus 62 lignes
par mois. Les objectifs sont agrégés en une seule somme.

Depuis M12-01, les répétitions hebdomadaire, trimestrielle et annuelle suivent
la même règle. Chaque date hebdomadaire porte sa propre résolution : réaliser
ou annuler le 9 ne retire pas celles du 16 et du 23. La validation d'une date
vérifie son appartenance à toutes les occurrences de la période, puis conserve
l'unicité propriétaire/règle/date et les garanties d'idempotence existantes.

## Résolutions

`EventOccurrenceResolution` persiste une décision par
`(userId, sourceEventId, occurrenceDate)` avec un instantané du titre, du
montant, de la devise et du sens. L'absence de ligne signifie `PLANNED`.

### Réalisation

`EventOccurrenceUseCases.realize` vérifie la règle du propriétaire, la date
d'occurrence et la catégorie, puis crée dans une transaction l'opération
ponctuelle et la résolution `REALIZED`. Titre, montant et date de l'opération
peuvent différer de la prévision.

- Une date d'opération d'un mois passé, ou d'une période déjà clôturée, est
  refusée par `PERIOD_CLOSED`. Une occurrence en retard se réalise donc à une
  date du mois courant.
- Répéter la même commande renvoie la résolution existante avec
  `replayed = true` et ne crée aucune seconde opération.
- Une commande différente, ou une réalisation après annulation, renvoie
  `OCCURRENCE_ALREADY_RESOLVED`.
- Deux requêtes concurrentes sont départagées par l'unicité de l'occurrence;
  la perdante relit la décision gagnante puis rejoue ou échoue comme ci-dessus.

### Annulation

`cancel` crée une résolution `CANCELED` sans opération. Une seconde annulation
est un rejeu; annuler une occurrence réalisée renvoie
`OCCURRENCE_ALREADY_RESOLVED`. L'annulation d'une occurrence passée reste
possible car elle ne modifie aucun montant réel.

### Conservation

- `sourceEventId` n'a pas de clé étrangère : supprimer une règle retire ses
  occurrences encore planifiées mais conserve ses décisions.
- `operationId` est unique et passe à `NULL` si l'opération est supprimée
  ensuite; la décision reste `REALIZED` et l'occurrence ne revient pas dans le
  prévisionnel.
- La suppression d'un compte supprime ses résolutions en cascade.

### Clôture

À la clôture d'un mois, `BudgetPeriod.unresolvedEvents` mémorise le nombre
d'occurrences restées sans décision. Ce compteur ne modifie pas le bilan réel.

## Migration

La migration additive `20261011120000_add_event_occurrence_resolutions` crée
la table, ses deux énumérations, l'unicité de l'occurrence, l'unicité de
l'opération liée et les index `(userId, occurrenceDate, status, id)` et
`(userId, currency, occurrenceDate, id)`. Aucune table existante n'est
modifiée.

Après `npm run db:deploy` :

```sql
SHOW CREATE TABLE EventOccurrenceResolution;
SELECT COUNT(*) FROM EventOccurrenceResolution;
```

Le compteur vaut zéro tant que l'API de `M05-04` n'est pas livrée.

## Retour arrière

Redéployer l'ancienne application suffit : elle ignore la nouvelle table. Ne
jamais supprimer la migration déployée. Si la table doit être retirée, exporter
d'abord ses lignes, car elles portent des décisions utilisateur, puis appliquer
une nouvelle migration en avant.
