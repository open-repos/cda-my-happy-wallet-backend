-- CreateTable
CREATE TABLE `EventOccurrenceResolution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourceEventId` INTEGER NOT NULL,
    `occurrenceDate` DATE NOT NULL,
    `status` ENUM('REALIZED', 'CANCELED') NOT NULL,
    `title` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `kind` ENUM('DEPENSE', 'ENTREE') NOT NULL,
    `operationId` INTEGER NULL,
    `resolvedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `EventOccurrenceResolution_operationId_key`(`operationId`),
    INDEX `EventOccurrenceResolution_userId_occurrenceDate_status_id_idx`(`userId`, `occurrenceDate`, `status`, `id`),
    INDEX `EventOccurrenceResolution_userId_currency_occurrenceDate_id_idx`(`userId`, `currency`, `occurrenceDate`, `id`),
    UNIQUE INDEX `EventOccurrenceResolution_userId_sourceEventId_occurrenceDat_key`(`userId`, `sourceEventId`, `occurrenceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventOccurrenceResolution` ADD CONSTRAINT `EventOccurrenceResolution_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `OneOffOperationRecord`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventOccurrenceResolution` ADD CONSTRAINT `EventOccurrenceResolution_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

