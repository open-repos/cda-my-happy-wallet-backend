CREATE TABLE `BudgetPeriod` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `periodStart` DATE NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `fixedIncome` DECIMAL(10, 2) NOT NULL,
  `fixedExpense` DECIMAL(10, 2) NOT NULL,
  `baseAmount` DECIMAL(10, 2) NOT NULL,
  `actualIncome` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `actualExpense` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `realRemaining` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `unresolvedEvents` INTEGER NOT NULL DEFAULT 0,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `closedAt` DATETIME(3) NULL,
  `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updatedAt` DATETIME(0) NOT NULL,
  `userId` INTEGER NOT NULL,

  UNIQUE INDEX `BudgetPeriod_userId_periodStart_currency_key`(
    `userId`, `periodStart`, `currency`
  ),
  INDEX `BudgetPeriod_userId_currency_periodStart_id_idx`(
    `userId`, `currency`, `periodStart`, `id`
  ),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BudgetPeriod`
  ADD CONSTRAINT `BudgetPeriod_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `OneOffOperationRecord_userId_currency_operationDate_id_idx`
  ON `OneOffOperationRecord`(`userId`, `currency`, `operationDate`, `id`);
