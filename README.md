# Projet-00-MyHappyWallet-BackEnd

Dans ce projet je mettrais toutes les tâches liées au Backend de mon projet "Chef d'oeuvre" CDA . 

## Getting started

## Tests backend

Framework retenu : Jest.

Raisons :

- Le backend est une application Express/TypeScript en CommonJS.
- La cible Docker actuelle reste Node 16 tant que Prisma 3.10 n'est pas mis a jour.
- Les tests existants sont des scripts Node/ts-node, sans dependance a Vite.
- Jest avec ts-jest et Supertest permet de couvrir les tests unitaires et API Express sans introduire Vite dans le backend.

La tache suivante doit ajouter Supertest et la configuration Jest minimale, puis migrer les tests ts-node progressivement.

L'environnement de test Docker cible est decrit dans [docs/test-environment.md](docs/test-environment.md).

Tests unitaires de services metier :

```bash
npm run test:services
```

Ce script couvre actuellement `ResteAVivreCalculator`, le service metier pur extrait.

## TODO

[ ] Relancer les différentes requêtes pour vérifier que le refactoring n'a pas impacté le code
