-- Icône Font Awesome facultative (`solid:<nom>` ou `regular:<nom>`).
-- Migration additive : les catégories existantes restent à NULL.
ALTER TABLE `OperationCategory` ADD COLUMN `icon` VARCHAR(64) NULL;
