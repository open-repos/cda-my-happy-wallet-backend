# Domaine du budget mensuel et journalier

## Statut

- Work Item : `M05-01`
- Décision produit et technique : retenue le 19 septembre 2026
- Périmètre : contrat de domaine et trajectoire de persistance
- Implémentation : `M05-02` à `M05-04`

## Objectif

Le budget avancé doit répondre sans ambiguïté à trois questions :

1. combien reste-t-il réellement après les opérations enregistrées ;
2. combien restera-t-il si les événements encore prévus se réalisent ;
3. combien peut-on encore dépenser par jour jusqu'à la fin du mois.

Le calcul porte toujours sur un propriétaire, un mois civil et une devise. Il
ne mélange pas les devises et n'applique aucun taux de change implicite.

## Vocabulaire

- **Période** : mois civil `YYYY-MM` dans une devise ISO 4217.
- **Socle** : revenus fixes moins charges fixes applicables à la période.
- **Opération réelle** : entrée ou dépense ponctuelle effectivement constatée.
- **Occurrence planifiée** : projection datée produite par une règle
  d'événement et qui n'a pas encore été résolue.
- **Résolution** : décision durable qui réalise ou annule une occurrence.
- **Reste réel** : argent disponible selon les seuls faits réalisés.
- **Reste prévisionnel** : reste réel corrigé par les occurrences planifiées.
- **Disponible prudent par jour** : reste prévisionnel réparti sur les jours
  restants, jour courant inclus.

Les montants sont positifs et leur sens financier est explicite. Le domaine
calcule en centimes entiers. La base utilise `DECIMAL(10,2)` et les DTO
sérialisent deux décimales; aucun arrondi intermédiaire n'est autorisé.

## Formules

Pour une période et une devise :

```text
socle = revenus fixes - charges fixes

reste réel =
  socle
  + entrées réelles
  - dépenses réelles

reste prévisionnel =
  reste réel
  + entrées planifiées non résolues
  - dépenses planifiées non résolues
```

Pour le mois civil courant, d'après la date locale injectée :

```text
jours restants = dernier jour du mois - aujourd'hui + 1
disponible réel/jour = reste réel / jours restants
disponible prudent/jour = reste prévisionnel / jours restants
```

Le jour courant est inclus. Une valeur négative n'est pas ramenée à zéro : elle
représente l'effort quotidien nécessaire pour terminer le mois à l'équilibre.
La division produit une valeur d'affichage; les totaux mensuels restent exacts
en centimes.

## Périodes ouvertes et clôturées

Une période est identifiée par `(userId, periodStart, currency)`, où
`periodStart` est le premier jour du mois.

### Ouverture

La période courante est ouverte paresseusement lors de la première lecture ou
écriture budgétaire du mois. Elle mémorise les totaux de revenus et charges
fixes connus. Une mutation d'opération fixe met à jour le snapshot de la période
courante ouverte dans la même transaction que l'écriture.

Ce snapshot évite qu'une modification future des charges réécrive un mois
antérieur. Il ne remplace pas les opérations ponctuelles, qui restent les faits
unitaires de référence.

### Clôture

Une période devient logiquement clôturée dès que son mois civil est terminé.
La première lecture ou écriture budgétaire ultérieure matérialise la clôture
avant de continuer. Aucun ordonnanceur n'est requis pour garantir la règle.

Lorsqu'aucune activité n'a eu lieu pendant un ou plusieurs mois, les périodes
manquantes reprennent le dernier snapshot fixe connu. Toute mutation
d'opération fixe matérialise d'abord les périodes écoulées avec l'ancien
snapshot, puis applique la nouvelle valeur à la période courante.

La clôture enregistre au minimum :

- totaux fixes et socle en centimes ;
- totaux réels d'entrées et de dépenses ;
- reste réel signé ;
- nombre d'occurrences demeurées sans décision ;
- date technique de clôture.

Le bilan d'un mois passé vaut `POSITIVE`, `BALANCED` ou `NEGATIVE` selon
le signe du reste réel clôturé. Les événements annulés ou planifiés ne changent
pas ce bilan; les éléments non résolus sont signalés séparément.

### Immutabilité

Une création, modification ou suppression d'opération qui affecterait une
période clôturée est refusée par un conflit métier `period_closed`. Une
correction comptable ou une réouverture auditée sort du MVP et demandera une
décision dédiée.

Les opérations futures restent autorisées tant que leur période n'est pas
clôturée. Une période future n'est pas incluse dans le disponible journalier du
mois courant.

## Cycle de vie d'une occurrence

Le statut porte sur l'occurrence datée, jamais sur toute la règle :

- `PLANNED` : aucune résolution persistée; l'occurrence participe au
  prévisionnel ;
- `REALIZED` : résolution liée à une opération réelle; l'occurrence sort du
  prévisionnel ;
- `CANCELED` : résolution sans opération; l'occurrence sort du prévisionnel.

Une occurrence planifiée dont la date est passée reste réservée et apparaît
dans la file « à traiter ». Elle ne disparaît que lorsque la personne la réalise
ou l'annule.

### Réalisation

La commande de réalisation accepte une catégorie et peut ajuster le titre, le
montant et la date réellement constatés. Elle effectue dans une transaction :

1. la vérification de la règle et de son propriétaire ;
2. la vérification de l'occurrence calculée ;
3. la création de l'opération ponctuelle ;
4. la création de la résolution `REALIZED`.

L'identité `(sourceEventId, occurrenceDate)` est unique et l'identifiant
d'opération liée est unique. Répéter exactement une commande déjà réussie
retourne le même résultat. Une commande incompatible avec une résolution
existante retourne un conflit stable et ne crée aucune seconde opération.

### Annulation

L'annulation crée une résolution `CANCELED` sans opération. Répéter
l'annulation réussit sans nouvelle écriture. Une occurrence réalisée ne peut
pas être annulée implicitement et une occurrence annulée ne peut pas être
réalisée sans une future commande explicite de réouverture.

### Conservation

Une résolution conserve un instantané minimal de l'occurrence : propriétaire,
identifiant de règle source, date, titre, montant, devise et sens. L'identifiant
source reste une valeur historique et ne dépend pas d'une suppression en
cascade de la règle.

Supprimer une règle retire ses occurrences encore planifiées, mais conserve les
résolutions et les opérations déjà réalisées. Une suppression de compte reste
une suppression en cascade de toutes les données du propriétaire.

## Persistance cible

### BudgetPeriod

La future table porte au minimum :

- `userId`, `periodStart DATE`, `currency CHAR(3)` ;
- `status OPEN|CLOSED` ;
- revenus fixes, charges fixes et socle en `DECIMAL(10,2)` ;
- totaux réels et reste réel clôturés, nullable avant clôture ;
- compteur d'occurrences non résolues à la clôture ;
- `revision`, `closedAt`, `createdAt`, `updatedAt`.

Contraintes et index :

- unicité `(userId, periodStart, currency)` ;
- index historique `(userId, currency, periodStart, id)` ;
- propriétaire obligatoire avec suppression en cascade.

### EventOccurrenceResolution

La future table porte au minimum :

- `userId`, `sourceEventId`, `occurrenceDate DATE` ;
- `status REALIZED|CANCELED` ;
- instantané du titre, montant, devise et sens ;
- `operationId` nullable et unique ;
- `resolvedAt`, `createdAt`, `updatedAt`.

Contraintes et index :

- unicité `(userId, sourceEventId, occurrenceDate)` ;
- index de file `(userId, occurrenceDate, status, id)` ;
- index mensuel `(userId, currency, occurrenceDate, id)` ;
- `operationId` obligatoire pour `REALIZED` et absent pour `CANCELED`,
  invariant également contrôlé dans le domaine et la transaction.

La référence historique `sourceEventId` n'impose pas de cascade vers la règle.
La résolution et l'opération sont toutefois liées au même propriétaire dans les
requêtes de création et de lecture.

### Opérations ponctuelles

Les agrégations mensuelles exigent l'index
`(userId, currency, operationDate, id)`. L'index existant
`(userId, operationDate, id)` reste utile pour les listes sans filtre de
devise; le plan SQL déterminera s'il doit être conservé après observation.

Les tables historiques `ResteAVivre` et `ResteAVivreFictif` ne deviennent
pas la source du nouveau moteur : elles n'identifient pas le mois, perdent les
centimes et ne relient pas les occurrences. La migration est additive. Elles
restent lisibles pendant la transition, puis cessent de recevoir de nouvelles
écritures. Leur retrait fera l'objet d'une migration ultérieure.

## Stratégie de calcul et performance

Une synthèse lit uniquement :

- une période et ses totaux fixes ;
- les opérations d'un intervalle mensuel dans une devise ;
- les règles capables de produire une occurrence dans ce mois ;
- les résolutions du même intervalle.

Le domaine construit au plus 31 points journaliers en mémoire. Il ne persiste
pas de ligne par jour et ne met pas à jour un total dérivé après chaque
opération. Ce choix évite les verrous et les divergences entre faits et
agrégats.

La liste détaillée des opérations reste une collection paginée par curseur avec
un ordre stable terminé par `id`. Le résumé mensuel contient uniquement les
compteurs et totaux nécessaires au calendrier; il ne transporte pas toutes les
opérations.

Un cache Redis pourra être ajouté après mesure avec une clé logique
`userId/period/currency/revision`. Il accélérera une vue reproductible et ne
deviendra pas source de vérité. Une table de synthèse asynchrone exigerait un
outbox transactionnel et n'est pas retenue sans preuve de charge.

## Contrats préparés pour M05-04

- `GET /budget-periods/{month}/summary?currency=EUR` : synthèse et série
  journalière bornée à 31 points ;
- `GET /budget-periods/history?currency=EUR&cursor=...` : bilans clôturés
  paginés ;
- `GET /operations?from=YYYY-MM-DD&to=YYYY-MM-DD&currency=EUR&cursor=...` :
  opérations du mois ou du jour ;
- `GET /event-occurrences/pending?through=YYYY-MM-DD&cursor=...` : file à
  traiter ;
- `POST /event-occurrences/{eventId}/{date}/realize` : réalisation atomique ;
- `POST /event-occurrences/{eventId}/{date}/cancel` : annulation idempotente.

Les dates sont civiles, l'horloge est injectée et les horodatages techniques
sont UTC. Les DTO ne contiennent ni `userId`, ni type Prisma, ni détail SQL.

## Exemples normatifs

### Mois de longueurs différentes

Un socle de 900 EUR donne un budget moyen indicatif de 32,14 EUR sur février
2027, 31,03 EUR sur février 2028, 30 EUR sur avril et 29,03 EUR sur janvier.
Le moteur conserve 90 000 centimes et n'additionne jamais ces valeurs arrondies.

### Dernier jour

Le 30 avril, `jours restants` vaut 1. Un reste prévisionnel de 25 EUR donne
25 EUR prudents pour la journée. Le calcul ne divise jamais par zéro.

### Résultat négatif

Avec un reste prévisionnel de -60 EUR et trois jours restants, le disponible
prudent vaut -20 EUR par jour. L'API conserve le signe et l'interface explique
l'effort requis.

### Événement réalisé

Une dépense planifiée de 50 EUR réduit le prévisionnel de 50 EUR. Sa réalisation
en opération réelle de 47,80 EUR retire la prévision et réduit le réel de
47,80 EUR dans la même transaction. Le total n'est jamais diminué de 97,80 EUR.

### Événement annulé ou en retard

Une occurrence annulée ne touche ni réel ni prévisionnel. Une occurrence
planifiée passée reste déduite du prévisionnel et apparaît à traiter jusqu'à
décision.

## Migration et retour arrière

Les migrations M05 seront immuables et additives :

1. créer les nouvelles tables et colonnes compatibles ;
2. ajouter les index sans réécrire les migrations déjà livrées ;
3. déployer le code qui lit l'ancien et le nouveau modèle si nécessaire ;
4. vérifier comptes, montants, propriétaires et plans SQL ;
5. basculer les écritures vers le nouveau modèle ;
6. retirer l'ancien modèle dans une migration ultérieure seulement.

Le rollback applicatif redéploie la version précédente tant que les anciennes
tables sont conservées. Une migration de production n'est jamais annulée par le
déploiement; toute correction de schéma utilise une nouvelle migration en avant.

## Vérification attendue

Les lots d'implémentation couvrent :

- mois de 28, 29, 30 et 31 jours, année bissextile et dernier jour ;
- centimes, grands montants acceptés, valeurs négatives et absence d'arrondi
  cumulatif ;
- clôture, refus d'écriture rétroactive et mutations fixes au changement de
  mois ;
- événements en retard, réalisation, annulation et commandes concurrentes ;
- idempotence, unicité, transaction et absence de double comptage ;
- isolation propriétaire et devise ;
- pagination, taille maximale de 31 points et plans SQL utilisant les index.

## Options écartées

### Persister chaque projection journalière

Cette solution multiplie les données dérivées et impose une invalidation à
chaque opération ou événement. Un calcul borné à 31 jours est plus simple,
cohérent et suffisamment petit.

### Maintenir un total courant à chaque écriture

Ce modèle accélère une lecture mais expose aux courses, aux doubles mises à jour
et aux réparations de données. Les faits indexés restent la source de vérité.

### Clôturer uniquement par une tâche planifiée

Un ordonnanceur peut être indisponible et crée une dépendance d'exploitation.
La clôture logique par date, matérialisée à la prochaine commande, garantit la
règle sans job obligatoire.

### Réouvrir silencieusement un mois

Une correction invisible réécrirait l'historique. Le MVP refuse les mutations
rétroactives; une future réouverture devra être explicite et auditée.
