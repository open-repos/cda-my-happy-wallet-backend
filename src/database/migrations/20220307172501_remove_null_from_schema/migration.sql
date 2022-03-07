/*
  Warnings:

  - Made the column `firstname` on table `Administrateur` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastname` on table `Administrateur` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password` on table `Administrateur` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Administrateur` required. This step will fail if there are existing NULL values in that column.
  - Made the column `categorie` on table `Categorie` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idChargeFixe` on table `ChargeFixe` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `DEPENSE` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `DEPENSE` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idEvenementMensuel` on table `EvenementMensuel` required. This step will fail if there are existing NULL values in that column.
  - Made the column `date` on table `EvenementMensuel` required. This step will fail if there are existing NULL values in that column.
  - Made the column `message` on table `Notification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `dateSent` on table `Notification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idUser` on table `Notification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantRaV` on table `ResteAVivre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantTotalDepense` on table `ResteAVivre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantTotalEntree` on table `ResteAVivre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idOperationFixe` on table `ResteAVivre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantRaVf` on table `ResteAVivreFictif` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantTotalDepense` on table `ResteAVivreFictif` required. This step will fail if there are existing NULL values in that column.
  - Made the column `montantTotalEntree` on table `ResteAVivreFictif` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idRevenu` on table `Revenu` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `Revenu` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `Revenu` required. This step will fail if there are existing NULL values in that column.
  - Made the column `idRaV` on table `Utilisateur` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Administrateur` MODIFY `firstname` VARCHAR(50) NOT NULL,
    MODIFY `lastname` VARCHAR(50) NOT NULL,
    MODIFY `password` VARCHAR(120) NOT NULL,
    MODIFY `email` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `Categorie` MODIFY `categorie` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `ChargeFixe` MODIFY `idChargeFixe` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `DEPENSE` MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `EvenementMensuel` MODIFY `idEvenementMensuel` INTEGER NOT NULL,
    MODIFY `date` DATE NOT NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `message` VARCHAR(255) NOT NULL,
    MODIFY `dateSent` DATE NOT NULL,
    MODIFY `idUser` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ResteAVivre` MODIFY `montantRaV` DECIMAL(10, 0) NOT NULL,
    MODIFY `montantTotalDepense` DECIMAL(10, 0) NOT NULL,
    MODIFY `montantTotalEntree` DECIMAL(10, 0) NOT NULL,
    MODIFY `idOperationFixe` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ResteAVivreFictif` MODIFY `montantRaVf` DECIMAL(10, 0) NOT NULL,
    MODIFY `montantTotalDepense` DECIMAL(10, 0) NOT NULL,
    MODIFY `montantTotalEntree` DECIMAL(10, 0) NOT NULL;

-- AlterTable
ALTER TABLE `Revenu` MODIFY `idRevenu` INTEGER NOT NULL,
    MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0);

-- AlterTable
ALTER TABLE `Utilisateur` MODIFY `idRaV` INTEGER NOT NULL;
