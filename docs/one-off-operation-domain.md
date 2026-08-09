# Domaine des opérations ponctuelles

## Statut

- Work Item : `M03-01`
- Décision technique : retenue le 9 août 2026
- Périmètre : domaine backend uniquement
- Schéma, repository, cas d'usage et API : Work Items suivantes de `M03`

## Contexte

Le schéma Prisma historique contient déjà `Operation`, `Categorie` et
`Periodique`, mais le code applicatif ne possède ni domaine ni cas d'usage pour
les opérations ponctuelles. Le modèle existant relie une catégorie globale à
une opération propriétaire et utilise `Date` pour une date civile. L'absence de
frontière de domaine rend possibles les arrondis implicites, les décalages de
date et la référence à la catégorie d'un autre utilisateur.

## Décision

Une opération ponctuelle est une entité de domaine pure, indépendante de Prisma,
avec les invariants suivants :

- identifiant et propriétaire sont des entiers strictement positifs ;
- le titre, normalisé par retrait des espaces externes, contient 2 à 50
  caractères ;
- le montant est positif, limité à deux décimales et conservé en centimes
  entiers ;
- la devise est un code alphabétique de trois lettres normalisé en majuscules ;
- le type vaut uniquement `DEPENSE` ou `ENTREE` ;
- la date est une date civile valide au format `YYYY-MM-DD` ;
- la catégorie et l'opération appartiennent au même utilisateur ;
- aucune information de récurrence n'appartient à une opération ponctuelle.

`OneOffOperation` et `Money` portent ces règles dans
`src/modules/operations/domain`. Ils n'importent ni Prisma, ni Express, ni un
validateur HTTP. Les futurs adapters convertiront explicitement les DTO et les
types de persistance vers ce domaine.

## Options examinées

### Réutiliser directement les types Prisma

Cette option réduit le nombre de types mais couple les règles métier au schéma,
expose `Decimal` et `Date` dans toutes les couches et ne permet pas de vérifier
la propriété de la catégorie avant la persistance.

### Utiliser des nombres décimaux JavaScript

Cette option est simple pour les contrôleurs mais introduit des erreurs binaires
sur les sommes financières. Les centimes entiers sont retenus ; la limite
`99 999 999,99` reste compatible avec le futur `DECIMAL(10,2)`.

### Conserver des catégories globales

Les données historiques utilisent une liste globale. Cette solution empêche
toute personnalisation et rend l'isolation utilisateur ambiguë. Le modèle cible
retient des catégories propriétaires ; la migration devra traiter explicitement
les catégories historiques au lieu de les attribuer silencieusement.

### Utiliser un objet `Date`

Une opération budgétaire porte une date civile, pas un instant. Une chaîne ISO
validée évite qu'un fuseau transforme le jour choisi lors de la sérialisation.

## Conséquences

### Positives

- les règles financières et de propriété sont testables sans base de données ;
- aucun montant invalide, type inconnu ou jour impossible ne traverse le
  domaine ;
- le futur repository devra toujours recevoir le propriétaire authentifié ;
- le schéma et l'API peuvent évoluer sans contaminer le domaine.

### Compromis

- les frontières HTTP et Prisma devront convertir centimes, `Decimal` et dates ;
- la liste des codes de devise n'est pas contrôlée contre un catalogue ISO dans
  ce lot ; seul le format est garanti ;
- la migration des catégories globales nécessite une règle produit ou un
  backfill explicite dans `M03-02`.

## Préparation de la migration M03-02

M03-01 ne modifie ni `schema.prisma` ni une migration existante. M03-02 devra
appliquer une stratégie d'expansion compatible avec les données actuelles :

1. créer les nouvelles structures ou colonnes sans supprimer `Operation` et
   `Categorie` ;
2. conserver les montants en `DECIMAL(10,2)` et les dates en type `DATE` ;
3. définir une propriété utilisateur pour chaque catégorie cible ;
4. inventorier les catégories et opérations historiques avant tout backfill ;
5. migrer les données dans une étape séparée et vérifier comptes, propriétaires,
   montants, devises et dates ;
6. basculer les adapters seulement après comparaison des données ;
7. retirer les anciennes structures dans une migration ultérieure, jamais dans
   la phase d'expansion.

Le rollback de la phase d'expansion consiste à redéployer la version applicative
précédente, qui continue d'utiliser les anciennes structures. Une migration
déployée n'est pas réécrite : toute correction utilise une nouvelle migration en
avant. Aucun backfill destructif n'est autorisé sans sauvegarde et comptages
avant/après.

## Inconnues et prochain contrôle

Avant M03-02, le propriétaire du produit doit préciser si les catégories sont
libres, prédéfinies par utilisateur ou initialisées depuis un catalogue commun.
Il faut également décider du comportement lors de la suppression d'une
catégorie encore référencée. Ces choix ne changent pas les invariants de M03-01,
mais conditionnent le schéma et le rollback de la migration.

## Vérification

```bash
npm run test:operations-domain
npm run type-check
```

Les tests couvrent le cas nominal, les deux types d'opération, les limites de
montant, la date civile, le format de devise et le refus d'une catégorie d'un
autre propriétaire.
