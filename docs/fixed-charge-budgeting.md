# Charges fixes périodiques et participation personnelle

Décision : frontend [#237](https://github.com/open-repos/cda-my-happy-wallet-frontend/issues/237), backend #122, enfant Web frontend #238.

Une charge fixe est un coût budgétaire mensualisé. Les événements et opérations
ponctuelles restent distincts : l'utilisateur ne doit pas ressaisir une charge
déjà intégrée au budget fixe comme événement ou opération, sous peine de la
compter deux fois. Le serveur ne détecte pas automatiquement ces doublons.
Aucun événement, opération bancaire, réserve, transfert ou remboursement n'est
créé automatiquement. Il n'y a ni suivi de provision ni rattrapage si le
prélèvement approche.

## Entrées et compatibilité

Les routes authentifiées existantes restent inchangées :

- `POST /v1/operations-fixes/charges` : création ;
- `PUT /v1/operations-fixes/charges/:id` : édition ;
- `GET /v1/operations-fixes/charges` : collection paginée ;
- `GET /v1/operations-fixes/charges/:id` : lecture historique, `data` est un tableau ;
- `DELETE /v1/operations-fixes/charges/:id` : suppression.

Les entrées de création et d'édition gardent `titre`, `montant`, `devise` et
acceptent deux champs facultatifs :

| Champ                  | Valeurs                                                                  | Création sans le champ | Édition sans le champ |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------- | --------------------- |
| `periodicite`          | `MENSUELLE`, `BIMESTRIELLE`, `TRIMESTRIELLE`, `SEMESTRIELLE`, `ANNUELLE` | `MENSUELLE`            | Inchangé              |
| `pourcentagePersonnel` | Nombre entre 0 et 100 inclus, au plus deux décimales                     | 100                    | Inchangé              |

`montant` reste le **total par échéance**, positif, entre 0,01 et
99 999 999,99 inclus, avec au plus deux décimales. La conversion historique
de nombres sous forme de chaîne reste acceptée par la validation.
`pourcentagePersonnel=0` conserve la charge pour information avec une part nulle.
La valeur 33,33 % est acceptée. Les champs calculés ne sont jamais utilisés comme
entrées de calcul et le propriétaire provient uniquement du jeton authentifié.

Les erreurs de saisie conservent le contrat historique : `400
IncompleteRequestBody`, avec les champs invalides. Les ressources d'un autre
propriétaire ou du mauvais type renvoient `404`, et une requête sans
authentification `401`. Les routes de revenus ne prennent pas en charge ces
deux nouveaux champs ; elles les refusent.

## Calcul et sortie

Les diviseurs des cinq périodicités sont respectivement 1, 2, 3, 6 et 12.
Bimestrielle signifie **tous les deux mois**.

Avant arrondi :

- part personnelle par échéance = total × pourcentage / 100 ;
- coût mensuel personnel = total × pourcentage / 100 / diviseur.

Chaque résultat est arrondi au centime le plus proche, avec les demi-centimes
vers le haut. Le coût mensuel est calculé directement à partir du total, sans
réutiliser une part par échéance déjà arrondie. Ainsi 0,11 €/an à 50 % donne
0,06 € par échéance mais 0,00 €/mois après arrondi ; la mensualisation est un
coût moyen au centime, sans allocation de centimes résiduels à une réserve.
Les totaux additionnent les coûts mensuels **arrondis de chaque charge**.
Deux charges mensuelles de 0,01 € à 50 % coûtent donc 0,02 €/mois ensemble.

La création et les lectures de charges ajoutent les champs suivants au DTO
public, sans identifiant propriétaire :

```json
{
  "idOperationFixe": 7,
  "titre": "Abonnement annuel",
  "montant": "120",
  "devise": "EUR",
  "periodicite": "ANNUELLE",
  "pourcentagePersonnel": 50,
  "montantPersonnel": "60.00",
  "montantMensuelPersonnel": "5.00"
}
```

`montant` garde sa sérialisation historique Prisma ; les deux nouveaux montants
calculés sont toujours des chaînes à deux décimales et le pourcentage est un
nombre. La collection ajoute aussi `typeOperation: "CHARGE"`. Le PUT et le
DELETE gardent leur réponse `{success, message}` ; relire après mutation.
La collection mixte `/operations-fixes` enrichit seulement ses charges ; les
revenus gardent leur DTO et leur calcul mensuel existants.

## Synthèses et historique

Le total fixe du budget applique la mensualisation côté serveur, avec filtrage
du propriétaire et de la devise. Le moteur du mois courant, les prévisions,
la simulation et la capacité d'épargne utilisent ce même total ; le frontend
ne doit pas soustraire à nouveau le coût affiché dans le formulaire.

Le mois courant ouvert relit le total fixe à la prochaine synthèse, y compris
après édition ou suppression. Les périodes déjà clôturées conservent leur
snapshot fixe ; la migration ne réécrit pas leur historique. Le comportement
existant de matérialisation des anciennes périodes reste inchangé. Aucun jour
de prélèvement ni date d'effet future n'est introduit.

Le RaV historique est aussi recalculé après chaque mutation. Il conserve son
ancien périmètre sans filtre de devise ; les synthèses avancées, utilisées par
l'accueil actuel, filtrent la devise. Son calcul utilise le même total précis,
mais sa table historique conserve ses colonnes `Decimal(10,0)` : l'écriture y
est toujours arrondie en euros entiers. Cette limite préexistante ne concerne
pas les snapshots `BudgetPeriod` ni les synthèses actuelles, qui conservent les
centimes. Aucune modification de type des anciennes colonnes n'est incluse
dans cette migration strictement additive.

## Migration et livraison

`20261022070000_add_fixed_charge_periodicity_share` ajoute seulement deux
colonnes à `OperationFixe`, avec les défauts mensuelle et 100 %. Elle ne
modifie aucun montant existant. Déployer la migration avant le nouveau
backend ; les anciens clients omettant ces champs restent compatibles.

Les migrations de production ne sont pas annulées par un retour à l'image
précédente. Les colonnes supplémentaires peuvent rester en place, mais
l'ancienne image ignore périodicité et pourcentage : **son calcul redevient
incorrect pour les charges non mensuelles ou partagées**. Après activation de
ces nouvelles données, privilégier un correctif compatible ; un rollback
applicatif nécessite une décision propriétaire. Ne pas supprimer les colonnes
ni réécrire les données comme procédure automatique de rollback.

## Tests

- `npm run test:fixed-charges` : calculs, arrondis, validation et requêtes HTTP
  avec les vrais contrôleurs/use cases/repository, persistance simulée ; inclus
  dans `test:services`.
- `npm run test:fixed-charge-migration` : reconstruction de l'ancien schéma et
  application de la migration uniquement sur MySQL jetable gardé par son hôte
  et son nom de base ; vérification des anciens montants et des défauts.
- `npm run test:fixed-charge-persistence` : SQL réel, sauvegarde/relecture,
  limites de pages, isolation, snapshot ouvert puis clôturé, RaV historique
  et absence d'événement/opération généré.

Les deux suites SQL sont incluses dans `test:repositories`, déjà exécutée par
la CI. Elles ne doivent jamais viser une base de développement ou production.
