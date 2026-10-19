-- Additive: legacy events remain confirmed; no financial values or dates are rewritten.
ALTER TABLE `EvenementMensuel`
  ADD COLUMN `status` ENUM('CONFIRME', 'POTENTIEL') NOT NULL DEFAULT 'CONFIRME';
CREATE INDEX `EvenementMensuel_userId_status_startDate_id_idx`
  ON `EvenementMensuel` (`userId`, `status`, `startDate`, `id`);
