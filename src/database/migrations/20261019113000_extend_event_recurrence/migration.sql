-- Append ENUM members without changing existing ordinals or rewriting event rows.
-- MySQL 8 must support this in-place operation; do not fall back to a table copy.
ALTER TABLE `EvenementMensuel`
  MODIFY `recurrence` ENUM('AUCUNE', 'MENSUELLE', 'HEBDOMADAIRE', 'TRIMESTRIELLE', 'ANNUELLE') NOT NULL DEFAULT 'AUCUNE',
  ALGORITHM=INPLACE,
  LOCK=NONE;
