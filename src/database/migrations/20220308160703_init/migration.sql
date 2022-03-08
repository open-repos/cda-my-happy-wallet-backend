-- CreateTable
CREATE TABLE `Administrateur` (
    `idAdmin` INTEGER NOT NULL AUTO_INCREMENT,
    `firstname` VARCHAR(50) NOT NULL,
    `lastname` VARCHAR(50) NOT NULL,
    `password` VARCHAR(120) NOT NULL,
    `email` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `Administrateur_email_key`(`email`),
    PRIMARY KEY (`idAdmin`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationFixe` (
    `idOperationFixe` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `devise` VARCHAR(3) NULL,
    `typeOperation` ENUM('CHARGE', 'REVENU') NOT NULL DEFAULT 'CHARGE',
    `userId` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idOperationFixe`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvenementMensuel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `devise` VARCHAR(3) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Utilisateur` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstname` VARCHAR(50) NOT NULL,
    `lastname` VARCHAR(50) NOT NULL,
    `password` VARCHAR(120) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Utilisateur_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `idNotif` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(255) NOT NULL,
    `dateSent` DATE NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`idNotif`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ObjectifFinancier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `devise` VARCHAR(3) NOT NULL,
    `dateObjectifAtteint` DATE NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Operation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 2) NOT NULL,
    `devise` VARCHAR(3) NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` ENUM('DEPENSE', 'ENTREE') NOT NULL DEFAULT 'DEPENSE',
    `idCategorie` INTEGER NOT NULL,
    `dateOperation` DATETIME(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Categorie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categorie` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Periodique` (
    `idPeriodique` INTEGER NOT NULL AUTO_INCREMENT,
    `periode` VARCHAR(7) NULL,
    `occurence` INTEGER NULL,
    `debutOccurence` DATE NULL,
    `finOccurence` DATE NULL,

    PRIMARY KEY (`idPeriodique`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResteAVivre` (
    `idRaV` INTEGER NOT NULL AUTO_INCREMENT,
    `montantRaV` DECIMAL(10, 0) NOT NULL,
    `montantTotalDepense` DECIMAL(10, 0) NOT NULL,
    `montantTotalEntree` DECIMAL(10, 0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`idRaV`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResteAVivreFictif` (
    `idRaVf` INTEGER NOT NULL AUTO_INCREMENT,
    `montantRaVf` DECIMAL(10, 0) NOT NULL,
    `montantTotalDepense` DECIMAL(10, 0) NOT NULL,
    `montantTotalEntree` DECIMAL(10, 0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`idRaVf`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OperationFixe` ADD CONSTRAINT `OperationFixe_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE `Periodique` ADD CONSTRAINT `Periodique_idPeriodique_fkey` FOREIGN KEY (`idPeriodique`) REFERENCES `Operation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResteAVivre` ADD CONSTRAINT `ResteAVivre_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResteAVivreFictif` ADD CONSTRAINT `ResteAVivreFictif_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
