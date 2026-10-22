-- Existing amounts remain untouched; old clients retain monthly/100% behavior.
ALTER TABLE `OperationFixe`
  ADD COLUMN `periodicite` ENUM('MENSUELLE', 'BIMESTRIELLE', 'TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE') NOT NULL DEFAULT 'MENSUELLE',
  ADD COLUMN `pourcentagePersonnel` DECIMAL(5, 2) NOT NULL DEFAULT 100;
