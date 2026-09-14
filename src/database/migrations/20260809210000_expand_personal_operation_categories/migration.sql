-- Expansion only: legacy Categorie and Operation tables remain untouched.
CREATE TABLE `OperationCategoryTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `color` CHAR(7) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,

    UNIQUE INDEX `OperationCategoryTemplate_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OperationCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `color` CHAR(7) NULL,
    `userId` INTEGER NOT NULL,
    `templateId` INTEGER NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,

    UNIQUE INDEX `OperationCategory_userId_name_key`(`userId`, `name`),
    UNIQUE INDEX `OperationCategory_id_userId_key`(`id`, `userId`),
    INDEX `OperationCategory_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OneOffOperationRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `legacyOperationId` INTEGER NULL,
    `title` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `type` ENUM('DEPENSE', 'ENTREE') NOT NULL DEFAULT 'DEPENSE',
    `operationDate` DATE NOT NULL,
    `userId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,

    UNIQUE INDEX `OneOffOperationRecord_legacyOperationId_key`(`legacyOperationId`),
    INDEX `OneOffOperationRecord_userId_operationDate_idx`(`userId`, `operationDate`),
    INDEX `OneOffOperationRecord_categoryId_userId_idx`(`categoryId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OperationCategory`
    ADD CONSTRAINT `OperationCategory_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OperationCategory`
    ADD CONSTRAINT `OperationCategory_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `OperationCategoryTemplate`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `OneOffOperationRecord`
    ADD CONSTRAINT `OneOffOperationRecord_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OneOffOperationRecord`
    ADD CONSTRAINT `OneOffOperationRecord_categoryId_userId_fkey`
    FOREIGN KEY (`categoryId`, `userId`) REFERENCES `OperationCategory`(`id`, `userId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
