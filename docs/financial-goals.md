# Objectifs financiers

## Statut

- Work Item : `M04-03`
- Décision produit : prévision par versement mensuel, retenue le
  11 octobre 2026
- Consommateurs suivants : interface Web `M04-05`, reste à vivre fictif
  `M05-03`

## Modèle

Un objectif appartient à un utilisateur et porte :

- un titre normalisé de 2 à 50 caractères ;
- un montant cible strictement positif ;
- un montant déjà épargné, positif ou nul, qui peut dépasser la cible ;
- un versement mensuel prévu, positif ou nul ;
- une devise ISO de trois lettres, sans conversion implicite ;
- une date souhaitée facultative, date civile `YYYY-MM-DD`.

Les montants ont au plus deux décimales et sont manipulés en centimes entiers
dans le domaine. Le montant épargné est un état saisi par l'utilisateur : le
MVP ne lie pas encore les opérations réelles à un objectif.

## Prévision

La prévision est une fonction pure de l'objectif et de la date civile du jour.
Le montant épargné représente l'état courant; le premier versement futur tombe
le mois suivant le mois de référence. Tous les arrondis se font au centime ou
au mois supérieur.

- `remainingAmount` : cible moins épargné, jamais négatif ;
- `contributionsNeeded` : nombre de versements nécessaires, `null` sans
  versement prévu ;
- `estimatedReachMonth` : mois de référence plus ce nombre de versements;
  `null` sans versement ou au-delà de 1 200 mois ;
- `requiredMonthlyContribution` : reste divisé par le nombre de mois entre le
  mois de référence et celui de la date souhaitée, seulement si ce nombre est
  positif.

| Statut        | Condition                                                          |
| ------------- | ------------------------------------------------------------------ |
| `REACHED`     | L'épargne couvre la cible.                                         |
| `NO_DEADLINE` | Aucune date souhaitée.                                             |
| `ON_TRACK`    | Le mois estimé ne dépasse pas celui de la date souhaitée.          |
| `BEHIND`      | La date reste atteignable mais le versement prévu est insuffisant. |
| `MISSED`      | Aucun versement futur n'est possible avant le mois souhaité.       |

Exemple au 11 octobre 2026 : cible 1 200 €, épargne 300 €, versement 150 €,
date souhaitée 15 mars 2027. Six versements sont nécessaires, l'atteinte est
estimée en avril 2027, le versement requis est 180 € et le statut vaut
`BEHIND`.

Le produit ne connaît pas encore le fuseau de chaque utilisateur. La date du
jour est donc calculée en `Europe/Paris` par une horloge injectable.

## API

Toutes les routes exigent le jeton d'accès et filtrent le propriétaire dans la
requête de persistance. Un objectif d'un autre utilisateur répond `404`.

| Méthode  | Route            | Réponse                               |
| -------- | ---------------- | ------------------------------------- |
| `GET`    | `/v1/goals`      | `200`, collection paginée par curseur |
| `POST`   | `/v1/goals`      | `201` et en-tête `Location`           |
| `GET`    | `/v1/goals/{id}` | `200`                                 |
| `PUT`    | `/v1/goals/{id}` | `200`, remplacement complet           |
| `DELETE` | `/v1/goals/{id}` | `204`                                 |

Le corps accepte `title`, `targetAmount`, `savedAmount`, `monthlyContribution`,
`currency` et `targetDate`. Les deux montants facultatifs valent `0.00` par
défaut. Tout champ inconnu, dont `ownerId`, est refusé en `422`. Le DTO expose
les montants en chaînes décimales et l'objet `forecast`; il n'expose ni
propriétaire ni horodatage technique.

## Persistance et migration

La migration additive `20261011090000_expand_financial_goals` conserve la table
historique `ObjectifFinancier` et ses colonnes. Elle ajoute `savedAmount` et
`monthlyContribution` avec la valeur `0`, rend la suppression du compte
cascadante et crée l'index `(userId, id)` utilisé par la pagination.
`dateObjectifAtteint` devient la date souhaitée.

Avant la production, sauvegarder la base et vérifier qu'aucune ligne existante
ne porte un montant nul ou négatif, qui serait refusé à la lecture :

```sql
SELECT COUNT(*) FROM ObjectifFinancier;
SELECT COUNT(*) FROM ObjectifFinancier WHERE montant <= 0;
```

Après `npm run db:deploy` :

```sql
SHOW CREATE TABLE ObjectifFinancier;
SHOW INDEX FROM ObjectifFinancier WHERE Key_name = 'ObjectifFinancier_userId_id_idx';
```

## Retour arrière

Redéployer l'ancienne application suffit : elle ignore les nouvelles colonnes,
dont les valeurs par défaut acceptent ses écritures. Ne jamais supprimer la
migration déployée; tout retrait passe par une nouvelle migration en avant
après sauvegarde des montants épargnés et versements saisis.
