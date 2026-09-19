# Domaine des événements mensuels

## Statut

- Work Item : `M04-01`
- Décision technique : retenue le 18 septembre 2026 pour le MVP
- Périmètre : règles de domaine backend uniquement
- Persistance, cas d'usage et API : `M04-02`

## Contexte

Un événement représente une entrée ou une dépense attendue dans le calendrier
budgétaire. Le schéma historique `EvenementMensuel` ne contient actuellement ni
date, ni sens financier, ni règle de répétition. Il ne permet donc pas de savoir
quand appliquer le montant ou s'il faut l'ajouter ou le retrancher.

Les opérations ponctuelles et fixes restent les écritures de référence du
budget. Un événement sert uniquement à prévoir un impact futur; il ne crée pas
automatiquement une opération réelle. Cette séparation évite de compter deux
fois le même montant lorsqu'une prévision se réalise.

## Décision

Un événement mensuel est une règle de prévision appartenant à un utilisateur.
La règle produit des occurrences de calendrier sans les enregistrer une par une.
Elle est indépendante de Prisma, Express et du fuseau horaire du serveur.

### Invariants de la règle

- l'identifiant et le propriétaire sont des entiers strictement positifs;
- le titre est normalisé par retrait des espaces externes et contient de 2 à 50
  caractères;
- le montant est strictement positif, limité à deux décimales et représenté en
  centimes entiers dans le domaine;
- la devise est un code alphabétique de trois lettres en majuscules;
- le sens financier vaut uniquement `DEPENSE` ou `ENTREE`;
- la date de début est une date civile ISO valide `YYYY-MM-DD`;
- la répétition vaut `AUCUNE` ou `MENSUELLE`;
- la date de fin est facultative, inclusive, et ne peut pas précéder la date de
  début;
- une répétition `AUCUNE` ne peut pas porter de date de fin;
- toutes les lectures et mutations filtrent le propriétaire authentifié dans
  la requête de persistance elle-même.

Le montant ne porte jamais de signe. Le sens détermine son effet : une entrée
augmente la projection et une dépense la diminue. Cette représentation évite les
combinaisons ambiguës telles qu'une dépense négative.

### Dates civiles et périodes

Les dates d'événement ne sont pas des instants UTC. Elles désignent un jour du
calendrier de l'utilisateur et sont échangées sous forme de chaîne `YYYY-MM-DD`.
Le backend ne leur applique aucune conversion de fuseau horaire.

Une période mensuelle est identifiée par `YYYY-MM`. Ses bornes vont du premier
au dernier jour du mois, inclusivement. Une occurrence appartient à la période
si sa date civile se trouve entre ces deux bornes.

### Répétition mensuelle

La date de début fournit le jour d'ancrage de la répétition. Une occurrence est
produite dans chaque mois à partir du mois de début, jusqu'à la date de fin
inclusive lorsqu'elle existe.

Si le jour d'ancrage n'existe pas dans un mois, l'occurrence tombe le dernier
jour de ce mois. Ainsi, un événement commencé le 31 janvier apparaît le 28 ou
29 février, puis retrouve le 31 dans les mois qui le permettent. Le calcul part
toujours du jour d'ancrage initial : il ne dérive pas après un mois court.

Une règle sans répétition produit exactement une occurrence à sa date de début.
La génération est une fonction pure de la règle et de la période demandée; elle
ne dépend ni de la date courante ni du fuseau du processus.

### Modification, suppression et réalisation

Le MVP modifie ou supprime la règle entière. Il ne gère ni exception sur une
occurrence, ni déplacement d'une seule occurrence, ni historique des anciennes
versions. Une modification s'applique aux occurrences calculées après la
réponse, y compris dans une période passée si celle-ci est relue.

Marquer un événement comme réalisé et le convertir automatiquement en opération
sortent du périmètre de `M04`. Lorsque l'utilisateur enregistre l'opération
réelle, les vues de prévision doivent distinguer explicitement événements et
opérations afin de ne pas les additionner deux fois.

## Contrat attendu pour M04-02

La persistance cible conserve au minimum : propriétaire, titre, montant
`DECIMAL(10,2)`, devise, sens, date de début `DATE`, répétition, date de fin
`DATE` facultative et horodatages techniques. Elle impose un effacement en
cascade avec le propriétaire et des index adaptés aux lectures propriétaires.

L'API devra séparer :

- le CRUD des règles d'événement;
- la lecture des occurrences calculées pour une période mensuelle.

Toutes les collections réutilisent le contrat de pagination par curseur décrit
dans [`api-pagination.md`](api-pagination.md). L'ordre des règles se termine par
une clé unique, par exemple `startDate ASC, id ASC`. L'ordre des occurrences est
`occurrenceDate ASC, eventId ASC`. Le curseur reste lié à la ressource, au
propriétaire et, pour les occurrences, à la période demandée.

Les DTO publics exposent des montants décimaux sérialisés et des dates civiles.
Ils n'exposent ni `userId`, ni type Prisma `Decimal`, ni structure interne du
curseur. Les identifiants reçus ne remplacent jamais l'identité authentifiée.

## Options examinées

### Enregistrer chaque occurrence

Cette solution facilite les exceptions unitaires mais multiplie les lignes,
impose de générer le futur à l'avance et rend difficiles les modifications de
série. Le MVP conserve une règle et calcule ses occurrences à la lecture.

### Utiliser un instant UTC

Un instant convient à un rendez-vous avec une heure, mais pas à une prévision
budgétaire portée par un jour. La conversion UTC peut déplacer l'événement au
jour précédent ou suivant. Une date civile est retenue.

### Reporter les jours inexistants au mois suivant

Faire du 31 février le 3 mars déplacerait une charge dans une autre période
budgétaire et pourrait produire deux occurrences en mars. Le dernier jour du
mois conserve une occurrence par mois et le jour d'ancrage initial.

### Utiliser un montant signé

Le signe réduit le nombre de champs mais autorise des états contradictoires et
rend les validations moins lisibles. Un montant positif associé à un sens
explicite est retenu, comme pour les opérations ponctuelles.

### Transformer automatiquement l'événement en opération

Cette automatisation semble pratique mais nécessite une règle de rapprochement,
un état de réalisation et une gestion des doublons qui ne sont pas spécifiés.
Le MVP garde prévisions et écritures réelles séparées.

## Conséquences

### Positives

- le calcul des occurrences est déterministe et testable sans base de données;
- les mois courts, années bissextiles et fuseaux ont une règle explicite;
- aucune génération planifiée ni stockage infini du futur n'est nécessaire;
- l'isolation propriétaire et la pagination sont définies avant l'API;
- événements prévisionnels et opérations réelles ne sont pas confondus.

### Compromis

- le calcul est répété à chaque lecture de période;
- le MVP ne peut pas modifier ou ignorer une occurrence isolée;
- une modification réécrit la projection historique lors d'une nouvelle lecture;
- la future interface doit expliquer qu'elle modifie toute la série.

### Risques et protections

- un grand nombre de règles pourrait rendre une période coûteuse : la requête et
  la réponse restent paginées et indexées par propriétaire;
- une mauvaise conversion `Date` pourrait décaler un jour : les frontières
  HTTP et Prisma convertissent explicitement les dates civiles et les tests
  couvrent plusieurs fuseaux;
- un événement pourrait être lu ou modifié par un autre compte : chaque accès
  filtre simultanément identifiant et propriétaire;
- une prévision pourrait être comptée avec son opération réelle : les DTO et les
  agrégats conservent leur nature et n'effectuent aucune conversion implicite.

## Décisions ultérieures

La conversion d'une occurrence en opération, son annulation et la conservation
de sa résolution sont désormais définies par
[`daily-budget-domain.md`](daily-budget-domain.md) pour `M05`. Elles restent
hors du périmètre de l'implémentation `M04`.

## Inconnues restantes

Les éléments suivants sont reportés hors du MVP et nécessiteront une nouvelle
décision produit avant extension du domaine :

- exceptions et modifications d'une seule occurrence;
- répétitions hebdomadaires, annuelles ou selon une règle libre;
- heure de la journée et rappels;
- conservation d'un historique immuable des projections.

Le prochain point de validation humaine intervient pendant la recette Web de
`M04-04` : vérifier que le libellé de modification d'une série, le comportement
du dernier jour du mois et la séparation prévision/réel sont compris sans aide.

## Vérification attendue

`M04-02` devra ajouter des tests de domaine pour les dates invalides, le 29
février, les jours 29 à 31, la date de fin inclusive, les deux sens financiers,
les limites monétaires et l'isolation propriétaire. `M04-07` complétera les cas
de fuseau, pagination et régression de prévision.
