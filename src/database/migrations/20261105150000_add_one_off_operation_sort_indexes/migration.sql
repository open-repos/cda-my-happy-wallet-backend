-- Additive indexes supporting owner-scoped sort by amount and title (#165).
CREATE INDEX `OneOffOperationRecord_userId_amount_id_idx`
  ON `OneOffOperationRecord`(`userId`, `amount`, `id`);

CREATE INDEX `OneOffOperationRecord_userId_title_id_idx`
  ON `OneOffOperationRecord`(`userId`, `title`, `id`);
