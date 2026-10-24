-- Additive schema. Legacy fixed operations remain uncategorized.
ALTER TABLE `OperationCategoryTemplate`
  ADD COLUMN `icon` VARCHAR(64) NULL,
  ADD COLUMN `fixedKind` ENUM('CHARGE', 'REVENU') NULL;
ALTER TABLE `OperationCategory`
  ADD COLUMN `fixedKind` ENUM('CHARGE', 'REVENU') NULL;
ALTER TABLE `OperationFixe`
  ADD COLUMN `categoryId` INTEGER NULL;
CREATE INDEX `OperationFixe_categoryId_userId_idx` ON `OperationFixe` (`categoryId`, `userId`);
ALTER TABLE `OperationFixe` ADD CONSTRAINT `OperationFixe_categoryId_userId_fkey`
  FOREIGN KEY (`categoryId`, `userId`) REFERENCES `OperationCategory` (`id`, `userId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The data statements are repeatable: never overwrite a personal category,
-- even if its name matches a new default (MySQL's existing name collation applies).
INSERT INTO `OperationCategoryTemplate`
  (`code`, `name`, `icon`, `fixedKind`, `sortOrder`, `active`, `createdAt`, `updatedAt`)
SELECT proposed.code, proposed.name, proposed.icon, proposed.fixedKind,
       proposed.sortOrder, true, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)
FROM (
SELECT 'FIXED_CHARGE_01' AS code, 'Logement' AS name, 'solid:house' AS icon, 'CHARGE' AS fixedKind, 100 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_02' AS code, 'Énergie et eau' AS name, 'solid:bolt' AS icon, 'CHARGE' AS fixedKind, 110 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_03' AS code, 'Télécoms et Internet' AS name, 'solid:wifi' AS icon, 'CHARGE' AS fixedKind, 120 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_04' AS code, 'Assurances' AS name, 'solid:shield-halved' AS icon, 'CHARGE' AS fixedKind, 130 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_05' AS code, 'Transports' AS name, 'solid:bus' AS icon, 'CHARGE' AS fixedKind, 140 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_06' AS code, 'Santé' AS name, 'solid:heart-pulse' AS icon, 'CHARGE' AS fixedKind, 150 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_07' AS code, 'Impôts et taxes' AS name, 'solid:receipt' AS icon, 'CHARGE' AS fixedKind, 160 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_08' AS code, 'Famille et éducation' AS name, 'solid:graduation-cap' AS icon, 'CHARGE' AS fixedKind, 170 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_09' AS code, 'Loisirs et services' AS name, 'solid:film' AS icon, 'CHARGE' AS fixedKind, 180 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_10' AS code, 'Autres crédits' AS name, 'solid:credit-card' AS icon, 'CHARGE' AS fixedKind, 190 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_11' AS code, 'Dons et cotisations' AS name, 'solid:hand-holding-heart' AS icon, 'CHARGE' AS fixedKind, 200 AS sortOrder
UNION ALL
SELECT 'FIXED_CHARGE_12' AS code, 'Autres charges' AS name, 'solid:wallet' AS icon, 'CHARGE' AS fixedKind, 210 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_13' AS code, 'Salaires' AS name, 'solid:money-bill-wave' AS icon, 'REVENU' AS fixedKind, 220 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_14' AS code, 'Activité indépendante' AS name, 'solid:briefcase' AS icon, 'REVENU' AS fixedKind, 230 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_15' AS code, 'Retraites et pensions' AS name, 'solid:landmark' AS icon, 'REVENU' AS fixedKind, 240 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_16' AS code, 'Aides et allocations' AS name, 'solid:hand-holding-dollar' AS icon, 'REVENU' AS fixedKind, 250 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_17' AS code, 'Revenus locatifs' AS name, 'solid:house-chimney-user' AS icon, 'REVENU' AS fixedKind, 260 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_18' AS code, 'Pensions alimentaires reçues' AS name, 'solid:people-roof' AS icon, 'REVENU' AS fixedKind, 270 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_19' AS code, 'Revenus de placements réguliers' AS name, 'solid:chart-line' AS icon, 'REVENU' AS fixedKind, 280 AS sortOrder
UNION ALL
SELECT 'FIXED_REVENU_20' AS code, 'Autres entrées' AS name, 'solid:circle-plus' AS icon, 'REVENU' AS fixedKind, 290 AS sortOrder
) AS proposed
LEFT JOIN `OperationCategoryTemplate` AS existing ON existing.code = proposed.code
WHERE existing.id IS NULL;

INSERT INTO `OperationCategory`
  (`name`, `color`, `icon`, `fixedKind`, `userId`, `templateId`, `createdAt`, `updatedAt`)
SELECT template.name, template.color, template.icon, template.fixedKind,
       account.id, template.id, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)
FROM `Utilisateur` AS account
CROSS JOIN `OperationCategoryTemplate` AS template
LEFT JOIN `OperationCategory` AS existing
  ON existing.userId = account.id AND existing.name = template.name
WHERE template.active = true AND template.fixedKind IS NOT NULL AND existing.id IS NULL;
