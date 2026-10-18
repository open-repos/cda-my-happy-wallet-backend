ALTER TABLE `ObjectifFinancier`
  ADD COLUMN `savedAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `monthlyContribution` DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE `ObjectifFinancier`
  DROP FOREIGN KEY `ObjectifFinancier_userId_fkey`;

ALTER TABLE `ObjectifFinancier`
  ADD CONSTRAINT `ObjectifFinancier_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `ObjectifFinancier_userId_id_idx`
  ON `ObjectifFinancier`(`userId`, `id`);
