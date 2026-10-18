ALTER TABLE `EvenementMensuel`
  ADD COLUMN `kind` ENUM('DEPENSE', 'ENTREE') NOT NULL DEFAULT 'DEPENSE',
  ADD COLUMN `startDate` DATE NULL,
  ADD COLUMN `recurrence` ENUM('AUCUNE', 'MENSUELLE') NOT NULL DEFAULT 'AUCUNE',
  ADD COLUMN `endDate` DATE NULL;

UPDATE `EvenementMensuel`
SET `startDate` = DATE(`created_at`)
WHERE `startDate` IS NULL;

ALTER TABLE `EvenementMensuel`
  MODIFY `startDate` DATE NOT NULL DEFAULT (CURRENT_DATE);

ALTER TABLE `EvenementMensuel`
  DROP FOREIGN KEY `EvenementMensuel_userId_fkey`;

ALTER TABLE `EvenementMensuel`
  ADD CONSTRAINT `EvenementMensuel_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `EvenementMensuel_userId_startDate_id_idx`
  ON `EvenementMensuel`(`userId`, `startDate`, `id`);
