-- AlterTable
ALTER TABLE `Utilisateur` ADD COLUMN `resetToken` VARCHAR(191) NULL,
    ADD COLUMN `resetTokenExpiration` DATETIME(3) NULL;
