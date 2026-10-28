-- CreateTable
CREATE TABLE `BudgetEnvelope` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `categoryId` INTEGER NULL,
    `startMonth` DATE NOT NULL,
    `endMonth` DATE NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,

    INDEX `BudgetEnvelope_categoryId_userId_idx`(`categoryId`, `userId`),
    INDEX `BudgetEnvelope_userId_currency_id_idx`(`userId`, `currency`, `id`),
    UNIQUE INDEX `BudgetEnvelope_id_userId_key`(`id`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReconciliationOccurrence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `month` DATE NOT NULL,
    `sourceKey` VARCHAR(40) NOT NULL,
    `sourceType` ENUM('ENVELOPE', 'FIXED_EXPENSE', 'FIXED_INCOME') NOT NULL,
    `envelopeId` INTEGER NULL,
    `fixedSourceId` INTEGER NULL,
    `title` VARCHAR(50) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `kind` ENUM('DEPENSE', 'ENTREE') NOT NULL,
    `referenceTotal` DECIMAL(10, 2) NOT NULL,
    `personalShare` DECIMAL(5, 2) NOT NULL,
    `planned` DECIMAL(10, 2) NOT NULL,
    `categoryId` INTEGER NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ReconciliationOccurrence_userId_month_currency_id_idx`(`userId`, `month`, `currency`, `id`),
    INDEX `ReconciliationOccurrence_envelopeId_userId_idx`(`envelopeId`, `userId`),
    UNIQUE INDEX `ReconciliationOccurrence_id_userId_key`(`id`, `userId`),
    UNIQUE INDEX `ReconciliationOccurrence_userId_month_sourceKey_key`(`userId`, `month`, `sourceKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReconciliationLink` (
    `operationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `occurrenceId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ReconciliationLink_occurrenceId_userId_idx`(`occurrenceId`, `userId`),
    UNIQUE INDEX `ReconciliationLink_operationId_userId_key`(`operationId`, `userId`),
    PRIMARY KEY (`operationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `OneOffOperationRecord_id_userId_key` ON `OneOffOperationRecord`(`id`, `userId`);

-- AddForeignKey
ALTER TABLE `BudgetEnvelope` ADD CONSTRAINT `BudgetEnvelope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetEnvelope` ADD CONSTRAINT `BudgetEnvelope_categoryId_userId_fkey` FOREIGN KEY (`categoryId`, `userId`) REFERENCES `OperationCategory`(`id`, `userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationOccurrence` ADD CONSTRAINT `ReconciliationOccurrence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationOccurrence` ADD CONSTRAINT `ReconciliationOccurrence_envelopeId_userId_fkey` FOREIGN KEY (`envelopeId`, `userId`) REFERENCES `BudgetEnvelope`(`id`, `userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationLink` ADD CONSTRAINT `ReconciliationLink_operationId_userId_fkey` FOREIGN KEY (`operationId`, `userId`) REFERENCES `OneOffOperationRecord`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReconciliationLink` ADD CONSTRAINT `ReconciliationLink_occurrenceId_userId_fkey` FOREIGN KEY (`occurrenceId`, `userId`) REFERENCES `ReconciliationOccurrence`(`id`, `userId`) ON DELETE RESTRICT ON UPDATE CASCADE;
