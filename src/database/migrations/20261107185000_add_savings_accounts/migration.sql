-- CreateTable
CREATE TABLE `SavingsAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `initialBalanceMinorUnits` BIGINT NOT NULL DEFAULT 0,
    `balanceMinorUnits` BIGINT NOT NULL DEFAULT 0,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SavingsAccount_userId_id_idx`(`userId`, `id`),
    UNIQUE INDEX `SavingsAccount_id_userId_key`(`id`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavingsGoalLink` (
    `accountId` INTEGER NOT NULL,
    `goalId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `linkedOn` DATE NOT NULL,

    UNIQUE INDEX `SavingsGoalLink_goalId_key`(`goalId`),
    UNIQUE INDEX `SavingsGoalLink_accountId_userId_key`(`accountId`, `userId`),
    UNIQUE INDEX `SavingsGoalLink_goalId_userId_key`(`goalId`, `userId`),
    PRIMARY KEY (`accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavingsMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `amountMinorUnits` BIGINT NOT NULL,
    `direction` ENUM('TO_SAVINGS', 'FROM_SAVINGS') NOT NULL,
    `reason` ENUM('MANUAL', 'MONTH_END', 'NEGATIVE_COVERAGE', 'GOAL') NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `operationDate` DATE NOT NULL,
    `idempotencyKey` VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SavingsMovement_userId_accountId_id_idx`(`userId`, `accountId`, `id`),
    INDEX `SavingsMovement_userId_currency_operationDate_id_idx`(`userId`, `currency`, `operationDate`, `id`),
    UNIQUE INDEX `SavingsMovement_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    UNIQUE INDEX `SavingsMovement_id_userId_key`(`id`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavingsOccurrenceResolution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accountId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `month` DATE NOT NULL,
    `sourceGoalId` INTEGER NOT NULL,
    `title` VARCHAR(50) NOT NULL,
    `amountMinorUnits` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `operationDate` DATE NOT NULL,
    `status` ENUM('CONFIRMED', 'CANCELED') NOT NULL,
    `movementId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SavingsOccurrenceResolution_movementId_key`(`movementId`),
    INDEX `SavingsOccurrenceResolution_userId_id_idx`(`userId`, `id`),
    UNIQUE INDEX `SavingsOccurrenceResolution_movementId_userId_key`(`movementId`, `userId`),
    UNIQUE INDEX `SavingsOccurrenceResolution_userId_accountId_month_key`(`userId`, `accountId`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ObjectifFinancier_id_userId_key` ON `ObjectifFinancier`(`id`, `userId`);

-- AddForeignKey
ALTER TABLE `SavingsAccount` ADD CONSTRAINT `SavingsAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsGoalLink` ADD CONSTRAINT `SavingsGoalLink_accountId_userId_fkey` FOREIGN KEY (`accountId`, `userId`) REFERENCES `SavingsAccount`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsGoalLink` ADD CONSTRAINT `SavingsGoalLink_goalId_userId_fkey` FOREIGN KEY (`goalId`, `userId`) REFERENCES `ObjectifFinancier`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsMovement` ADD CONSTRAINT `SavingsMovement_accountId_userId_fkey` FOREIGN KEY (`accountId`, `userId`) REFERENCES `SavingsAccount`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsOccurrenceResolution` ADD CONSTRAINT `SavingsOccurrenceResolution_accountId_userId_fkey` FOREIGN KEY (`accountId`, `userId`) REFERENCES `SavingsAccount`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavingsOccurrenceResolution` ADD CONSTRAINT `SavingsOccurrenceResolution_movementId_userId_fkey` FOREIGN KEY (`movementId`, `userId`) REFERENCES `SavingsMovement`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE `SavingsAccount`
  ADD CONSTRAINT `SavingsAccount_initial_range` CHECK (`initialBalanceMinorUnits` BETWEEN 0 AND 9999999999),
  ADD CONSTRAINT `SavingsAccount_balance_range` CHECK (`balanceMinorUnits` BETWEEN 0 AND 9999999999);
ALTER TABLE `SavingsMovement`
  ADD CONSTRAINT `SavingsMovement_positive_amount` CHECK (`amountMinorUnits` BETWEEN 1 AND 9999999999),
  ADD CONSTRAINT `SavingsMovement_reason_direction` CHECK (
    (`reason` IN ('MONTH_END', 'GOAL') AND `direction` = 'TO_SAVINGS') OR
    (`reason` = 'NEGATIVE_COVERAGE' AND `direction` = 'FROM_SAVINGS') OR `reason` = 'MANUAL'
  );
ALTER TABLE `SavingsOccurrenceResolution`
  ADD CONSTRAINT `SavingsOccurrenceResolution_positive_amount` CHECK (`amountMinorUnits` BETWEEN 1 AND 9999999999);
