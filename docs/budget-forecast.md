# Prévision budgétaire sur plusieurs mois

Depuis M12-04, `scenario=simulation` inclut explicitement les potentiels ; la
lecture normale les exclut. Le nettoyage des potentiels expirés est la seule
écriture de maintenance autorisée sur cette route. Voir [Simulation](budget-simulation.md).

`GET /v1/budget-forecast?from=2026-10&months=12&currency=EUR`

Cette lecture privée utilise exclusivement le propriétaire authentifié. `from`
et `currency` sont obligatoires ; `months` vaut 12 par défaut (entier de 1 à
24). La devise est normalisée en majuscules, sans conversion. Les paramètres
inconnus, tableaux et doublons sont refusés (`422`). `from` désigne le mois
courant ou l'un des 23 suivants : cette borne limite aussi le calcul des mois
intermédiaires lorsque la fenêtre commence dans le futur. La réponse contient
exactement `months` mois, au plus 47 mois sont calculés, mois intermédiaires inclus.

La date de référence est injectée en `Europe/Paris`. Cette route n'ouvre ni ne
clôture une période, ne crée aucune résolution et ne réserve aucun argent. Sa
seule écriture est le nettoyage des potentiels expirés décrit ci-dessus. La
synthèse historique existante garde son contrat.

## Hypothèses et calculs

Les montants sont des centimes entiers signés, sérialisés en chaînes à deux
décimales. Les totaux ne sont jamais calculés en additionnant les valeurs
journalières arrondies. Les dépassements d'entiers sûrs sont refusés.

Le point de départ `currentRealRemaining` suit
[le domaine journalier](daily-budget-domain.md) : report réel antérieur + socle
courant + entrées réelles - dépenses réelles. Si le mois courant n'est pas
matérialisé, le report est reconstruit en mémoire depuis le dernier bilan clôturé
ou le premier mois d'activité, avec les snapshots fixes historiques. Sans activité
antérieure, le report vaut zéro. Aucun mois manquant n'est écrit.

Le socle affiché vaut toujours `fixedIncome - fixedExpense`. Les mois futurs
répètent les totaux fixes actuels et les versements mensuels des objectifs actifs
de la devise (non atteints, versement positif), sans supposer une hausse de
revenu ni un avancement automatique du montant épargné. Le traitement des
objectifs reste celui de la prévision mensuelle existante. Les occurrences
résolues ne participent pas aux entrées/dépenses planifiées.

Pour le mois courant, le socle et les opérations réelles sont déjà compris
dans le point de départ et ne sont pas ajoutés une seconde fois :

```text
carryIn = currentRealRemaining
forecastResult = plannedIncome - plannedExpense - goalSavings
forecastRemaining = carryIn + forecastResult
```

Pour chaque mois futur :

```text
carryIn = forecastRemaining du mois précédent
forecastResult = base + plannedIncome - plannedExpense - goalSavings
forecastRemaining = carryIn + forecastResult
```

Une fenêtre future calcule d'abord tous les mois intermédiaires depuis le mois
courant, puis les masque. Le report d'entrée de sa première ligne est donc le
solde projeté du mois précédent. Le report prévisionnel ne change jamais le
report réel persisté. Les montants négatifs restent négatifs.

Le disponible prudent décrit le solde final réparti sur les jours restants,
jour courant inclus ; les mois futurs comptent tous leurs jours civils :

```text
remainingDays = dernier jour - aujourd'hui + 1 (mois courant)
remainingDays = nombre de jours du mois (futur)
prudentDailyAllowance = arrondi(forecastRemaining / remainingDays)
prudentWeeklyAllowance = arrondi(forecastRemaining × min(7, remainingDays) / remainingDays)
prudentMonthlyAllowance = forecastRemaining
```

Les divisions d'affichage suivent `Math.round`, comme la synthèse mensuelle
existante (égalité vers +∞, y compris pour les déficits). La semaine est plafonnée
aux jours qui restent dans le mois ; son calcul ne multiplie pas le montant
journalier déjà arrondi. Il ne s'agit pas d'un conseil financier.

Exemple : reste réel 60 €, dépense prévue 60 €, épargne 10 € : fin du mois
courant -10 €. Avec un socle de 80 € et 10 € d'épargne le mois suivant, le solde
suivant vaut 60 € (ou 65 € avec une entrée prévue de 5 €).

## Vérification

`npm run test:multi-month-forecast` couvre les calculs, les reports négatifs,
les mois sautés, les bornes, les arrondis et le contrat HTTP avec un dépôt de
lecture injecté. Cette suite est aussi appelée par `test:budget-forecast-domain`,
déjà exécutée en CI. `test:budget-projection-api` vérifie avec MySQL les montants,
l'isolation par propriétaire/devise et l'absence d'écriture avant la première
synthèse matérialisée lorsqu'aucun potentiel expiré n'existe. La Simulation ajoute
une migration additive de statut, décrite dans [sa documentation](budget-simulation.md).
