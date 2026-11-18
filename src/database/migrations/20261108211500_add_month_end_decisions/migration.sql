CREATE TABLE `MonthEndDecision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `month` DATE NOT NULL,
    `operationDate` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `revision` INTEGER NOT NULL,
    `referenceResultMinorUnits` BIGINT NOT NULL,
    `savingsMinorUnits` BIGINT NOT NULL,
    `coverageMinorUnits` BIGINT NOT NULL,
    `exceptionalIncomeMinorUnits` BIGINT NOT NULL,
    `allocations` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `MonthEndDecision_userId_currency_operationDate_id_idx`(`userId`, `currency`, `operationDate`, `id`),
    UNIQUE INDEX `MonthEndDecision_userId_month_currency_key`(`userId`, `month`, `currency`),
    UNIQUE INDEX `MonthEndDecision_id_userId_key`(`id`, `userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `MonthEndDecision_amounts_check` CHECK (
      `revision` > 0 AND
      `savingsMinorUnits` BETWEEN 0 AND 9999999999 AND
      `coverageMinorUnits` BETWEEN 0 AND 9999999999 AND
      `exceptionalIncomeMinorUnits` BETWEEN 0 AND 9999999999
    )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MonthEndDecisionReceipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `decisionId` INTEGER NOT NULL,
    `revision` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `response` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `MonthEndDecisionReceipt_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    UNIQUE INDEX `MonthEndDecisionReceipt_decisionId_revision_key`(`decisionId`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SavingsMovement`
    ADD COLUMN `isCompensation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `monthEndDecisionId` INTEGER NULL,
    ADD COLUMN `monthEndRevision` INTEGER NULL;
ALTER TABLE `MonthEndDecision` ADD CONSTRAINT `MonthEndDecision_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MonthEndDecisionReceipt` ADD CONSTRAINT `MonthEndDecisionReceipt_decisionId_userId_fkey`
    FOREIGN KEY (`decisionId`, `userId`) REFERENCES `MonthEndDecision`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SavingsMovement` ADD CONSTRAINT `SavingsMovement_monthEndDecisionId_userId_fkey`
    FOREIGN KEY (`monthEndDecisionId`, `userId`) REFERENCES `MonthEndDecision`(`id`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Compensations require a positive month-end revision. The application also
-- supplies the decision ID: MySQL disallows CHECK on this CASCADE FK column.
ALTER TABLE `SavingsMovement` DROP CHECK `SavingsMovement_reason_direction`;
ALTER TABLE `SavingsMovement`
    ADD CONSTRAINT `SavingsMovement_month_end_metadata` CHECK (
      (`monthEndRevision` IS NULL AND NOT `isCompensation`) OR
      (`monthEndRevision` IS NOT NULL AND `monthEndRevision` > 0 AND `reason` IN ('MONTH_END', 'NEGATIVE_COVERAGE'))
    ),
    ADD CONSTRAINT `SavingsMovement_reason_direction` CHECK (
      (NOT `isCompensation` AND (
        (`reason` IN ('MONTH_END', 'GOAL') AND `direction` = 'TO_SAVINGS') OR
        (`reason` = 'NEGATIVE_COVERAGE' AND `direction` = 'FROM_SAVINGS') OR `reason` = 'MANUAL'
      )) OR
      (`isCompensation` AND (
        (`reason` = 'MONTH_END' AND `direction` = 'FROM_SAVINGS') OR
        (`reason` = 'NEGATIVE_COVERAGE' AND `direction` = 'TO_SAVINGS')
      ))
    );
