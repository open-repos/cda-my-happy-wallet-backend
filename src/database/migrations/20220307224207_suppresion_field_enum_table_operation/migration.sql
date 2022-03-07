/*
  Warnings:

  - The primary key for the `Categorie` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idCategorie` on the `Categorie` table. All the data in the column will be lost.
  - The primary key for the `EvenementMensuel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `date` on the `EvenementMensuel` table. All the data in the column will be lost.
  - You are about to drop the column `idEvenementMensuel` on the `EvenementMensuel` table. All the data in the column will be lost.
  - You are about to drop the column `idListEventObject` on the `EvenementMensuel` table. All the data in the column will be lost.
  - You are about to drop the column `idUser` on the `Notification` table. All the data in the column will be lost.
  - The primary key for the `ObjectifFinancier` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idListEventObject` on the `ObjectifFinancier` table. All the data in the column will be lost.
  - You are about to drop the column `idObjectifFinancier` on the `ObjectifFinancier` table. All the data in the column will be lost.
  - The primary key for the `Operation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idOperation` on the `Operation` table. All the data in the column will be lost.
  - The primary key for the `Periodique` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idOperation` on the `Periodique` table. All the data in the column will be lost.
  - The primary key for the `Ponctuel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idOperation` on the `Ponctuel` table. All the data in the column will be lost.
  - You are about to drop the column `idOperationFixe` on the `ResteAVivre` table. All the data in the column will be lost.
  - You are about to drop the column `idUser` on the `ResteAVivreFictif` table. All the data in the column will be lost.
  - The primary key for the `Utilisateur` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `idUser` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the `ChargeFixe` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DEPENSE` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ENTREE` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ListeEventObj` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Revenu` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `Administrateur` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `EvenementMensuel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `ObjectifFinancier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Operation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `ResteAVivre` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `ResteAVivreFictif` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `devise` to the `EvenementMensuel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montant` to the `EvenementMensuel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titre` to the `EvenementMensuel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `EvenementMensuel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `devise` to the `ObjectifFinancier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montant` to the `ObjectifFinancier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titre` to the `ObjectifFinancier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ObjectifFinancier` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_at` on table `ObjectifFinancier` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `ObjectifFinancier` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `idTypeOperation` to the `Operation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Operation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ResteAVivre` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ResteAVivreFictif` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Categorie` DROP PRIMARY KEY,
    DROP COLUMN `idCategorie`,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `EvenementMensuel` DROP PRIMARY KEY,
    DROP COLUMN `date`,
    DROP COLUMN `idEvenementMensuel`,
    DROP COLUMN `idListEventObject`,
    ADD COLUMN `devise` VARCHAR(3) NOT NULL,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `montant` DECIMAL(10, 0) NOT NULL,
    ADD COLUMN `titre` VARCHAR(50) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Notification` DROP COLUMN `idUser`,
    ADD COLUMN `userId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ObjectifFinancier` DROP PRIMARY KEY,
    DROP COLUMN `idListEventObject`,
    DROP COLUMN `idObjectifFinancier`,
    ADD COLUMN `devise` VARCHAR(3) NOT NULL,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `montant` DECIMAL(10, 0) NOT NULL,
    ADD COLUMN `titre` VARCHAR(50) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    MODIFY `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Operation` DROP PRIMARY KEY,
    DROP COLUMN `idOperation`,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD COLUMN `idTypeOperation` INTEGER NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `OperationFixe` ADD COLUMN `typeOperation` ENUM('CHARGE', 'REVENU') NOT NULL DEFAULT 'CHARGE';

-- AlterTable
ALTER TABLE `Periodique` DROP PRIMARY KEY,
    DROP COLUMN `idOperation`,
    ADD COLUMN `idPeriodique` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`idPeriodique`);

-- AlterTable
ALTER TABLE `Ponctuel` DROP PRIMARY KEY,
    DROP COLUMN `idOperation`,
    ADD COLUMN `idPonctuel` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`idPonctuel`);

-- AlterTable
ALTER TABLE `ResteAVivre` DROP COLUMN `idOperationFixe`,
    ADD COLUMN `userId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `ResteAVivreFictif` DROP COLUMN `idUser`,
    ADD COLUMN `userId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `Utilisateur` DROP PRIMARY KEY,
    DROP COLUMN `idUser`,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `ChargeFixe`;

-- DropTable
DROP TABLE `DEPENSE`;

-- DropTable
DROP TABLE `ENTREE`;

-- DropTable
DROP TABLE `ListeEventObj`;

-- DropTable
DROP TABLE `Revenu`;

-- CreateTable
CREATE TABLE `TypeOperation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `typeOperation` ENUM('DEPENSE', 'ENTREE') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Administrateur_email_key` ON `Administrateur`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `EvenementMensuel_userId_key` ON `EvenementMensuel`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `Notification_userId_key` ON `Notification`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `ObjectifFinancier_userId_key` ON `ObjectifFinancier`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `Operation_userId_key` ON `Operation`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `ResteAVivre_userId_key` ON `ResteAVivre`(`userId`);

-- CreateIndex
CREATE UNIQUE INDEX `ResteAVivreFictif_userId_key` ON `ResteAVivreFictif`(`userId`);

-- AddForeignKey
ALTER TABLE `EvenementMensuel` ADD CONSTRAINT `EvenementMensuel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ObjectifFinancier` ADD CONSTRAINT `ObjectifFinancier_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_idCategorie_fkey` FOREIGN KEY (`idCategorie`) REFERENCES `Categorie`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Operation` ADD CONSTRAINT `Operation_idTypeOperation_fkey` FOREIGN KEY (`idTypeOperation`) REFERENCES `TypeOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Periodique` ADD CONSTRAINT `Periodique_idPeriodique_fkey` FOREIGN KEY (`idPeriodique`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ponctuel` ADD CONSTRAINT `Ponctuel_idPonctuel_fkey` FOREIGN KEY (`idPonctuel`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResteAVivre` ADD CONSTRAINT `ResteAVivre_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResteAVivreFictif` ADD CONSTRAINT `ResteAVivreFictif_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
