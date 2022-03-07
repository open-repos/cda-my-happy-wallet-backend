-- CreateTable
CREATE TABLE `Administrateur` (
    `idAdmin` INTEGER NOT NULL AUTO_INCREMENT,
    `firstname` VARCHAR(50) NULL,
    `lastname` VARCHAR(50) NULL,
    `password` VARCHAR(120) NULL,
    `email` VARCHAR(255) NULL,

    PRIMARY KEY (`idAdmin`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Categorie` (
    `idCategorie` INTEGER NOT NULL AUTO_INCREMENT,
    `categorie` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idCategorie`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChargeFixe` (
    `idOperationFixe` INTEGER NOT NULL,
    `idChargeFixe` INTEGER NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idOperationFixe`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DEPENSE` (
    `idOperation` INTEGER NOT NULL,
    `idUser` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idOperation`, `idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ENTREE` (
    `idOperation` INTEGER NOT NULL,
    `idUser` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idOperation`, `idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvenementMensuel` (
    `idListEventObject` INTEGER NOT NULL,
    `idEvenementMensuel` INTEGER NULL,
    `date` DATE NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idListEventObject`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ListeEventObj` (
    `idListEventObject` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 0) NOT NULL,
    `devise` VARCHAR(3) NOT NULL,

    PRIMARY KEY (`idListEventObject`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `idNotif` INTEGER NOT NULL AUTO_INCREMENT,
    `message` VARCHAR(255) NULL,
    `dateSent` DATE NULL,
    `idUser` INTEGER NULL,

    PRIMARY KEY (`idNotif`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ObjectifFinancier` (
    `idListEventObject` INTEGER NOT NULL,
    `idObjectifFinancier` INTEGER NULL,
    `dateObjectifAtteint` DATE NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idListEventObject`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Operation` (
    `idOperation` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 0) NOT NULL,
    `devise` VARCHAR(3) NOT NULL,
    `idCategorie` INTEGER NOT NULL,

    PRIMARY KEY (`idOperation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationFixe` (
    `idOperationFixe` INTEGER NOT NULL AUTO_INCREMENT,
    `titre` VARCHAR(50) NOT NULL,
    `montant` DECIMAL(10, 0) NOT NULL,
    `devise` VARCHAR(3) NULL,

    PRIMARY KEY (`idOperationFixe`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Periodique` (
    `idOperation` INTEGER NOT NULL,
    `periode` VARCHAR(7) NULL,
    `occurence` INTEGER NULL,
    `debutOccurence` DATE NULL,
    `finOccurence` DATE NULL,

    PRIMARY KEY (`idOperation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ponctuel` (
    `idOperation` INTEGER NOT NULL,

    PRIMARY KEY (`idOperation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResteAVivre` (
    `idRaV` INTEGER NOT NULL AUTO_INCREMENT,
    `montantRaV` DECIMAL(10, 0) NULL,
    `montantTotalDepense` DECIMAL(10, 0) NULL,
    `montantTotalEntree` DECIMAL(10, 0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `idOperationFixe` INTEGER NULL,

    PRIMARY KEY (`idRaV`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResteAVivreFictif` (
    `idRaVf` INTEGER NOT NULL AUTO_INCREMENT,
    `montantRaVf` DECIMAL(10, 0) NULL,
    `montantTotalDepense` DECIMAL(10, 0) NULL,
    `montantTotalEntree` DECIMAL(10, 0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `idUser` INTEGER NULL,

    PRIMARY KEY (`idRaVf`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Revenu` (
    `idOperationFixe` INTEGER NOT NULL,
    `idRevenu` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`idOperationFixe`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Utilisateur` (
    `idUser` INTEGER NOT NULL AUTO_INCREMENT,
    `firstname` VARCHAR(50) NOT NULL,
    `lastname` VARCHAR(50) NOT NULL,
    `password` VARCHAR(120) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `idRaV` INTEGER NULL,

    UNIQUE INDEX `Utilisateur_email_key`(`email`),
    PRIMARY KEY (`idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
