/*
  Warnings:

  - You are about to drop the `Administrateur` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `Administrateur`;
