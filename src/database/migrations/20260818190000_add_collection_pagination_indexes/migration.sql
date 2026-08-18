-- Additive indexes supporting stable owner-scoped cursor pagination.
CREATE INDEX `OperationFixe_userId_idOperationFixe_idx`
  ON `OperationFixe`(`userId`, `idOperationFixe`);

CREATE INDEX `OperationFixe_userId_typeOperation_idOperationFixe_idx`
  ON `OperationFixe`(`userId`, `typeOperation`, `idOperationFixe`);

CREATE INDEX `OperationCategory_userId_name_id_idx`
  ON `OperationCategory`(`userId`, `name`, `id`);

CREATE INDEX `OneOffOperationRecord_userId_operationDate_id_idx`
  ON `OneOffOperationRecord`(`userId`, `operationDate`, `id`);
