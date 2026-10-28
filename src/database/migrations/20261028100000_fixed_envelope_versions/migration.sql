-- Existing charges remain ordinary charges. Explicit owner opt-in is required.
ALTER TABLE `OperationFixe`
 ADD COLUMN `isBudgetEnvelope` BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN `budgetStartMonth` DATE NULL,
 ADD COLUMN `budgetEndMonth` DATE NULL,
 ADD COLUMN `budgetArchived` BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX `OperationFixe_idOperationFixe_userId_key` ON `OperationFixe` (`idOperationFixe`, `userId`);
CREATE TABLE `FixedOperationVersion` (
 `id` INTEGER NOT NULL AUTO_INCREMENT,
 `userId` INTEGER NOT NULL,
 `operationId` INTEGER NOT NULL,
 `effectiveMonth` DATE NOT NULL,
 `payload` JSON NOT NULL,
 `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
 PRIMARY KEY (`id`),
 UNIQUE INDEX `FixedOperationVersion_operationId_effectiveMonth_key` (`operationId`, `effectiveMonth`),
 INDEX `FixedOperationVersion_userId_effectiveMonth_operationId_idx` (`userId`, `effectiveMonth`, `operationId`),
 CONSTRAINT `FixedOperationVersion_operationId_userId_fkey` FOREIGN KEY (`operationId`, `userId`)
 REFERENCES `OperationFixe` (`idOperationFixe`, `userId`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
