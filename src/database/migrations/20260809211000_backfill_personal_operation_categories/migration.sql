-- Stable defaults reuse the historical category catalogue; colors stay nullable
-- until a product-owned palette is assigned through the design system.
INSERT INTO `OperationCategoryTemplate`
    (`code`, `name`, `sortOrder`, `active`, `createdAt`, `updatedAt`)
VALUES
    ('ALIMENTATION', 'Alimentation', 10, true, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
    ('LOISIR', 'Loisir', 20, true, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
    ('IMPREVU', 'Imprevu', 30, true, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
    ('AUTRES', 'Autres', 40, true, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0));

-- Existing users receive an independent copy of every active default.
INSERT INTO `OperationCategory`
    (`name`, `color`, `userId`, `templateId`, `createdAt`, `updatedAt`)
SELECT
    template.`name`,
    template.`color`,
    account.`id`,
    template.`id`,
    CURRENT_TIMESTAMP(0),
    CURRENT_TIMESTAMP(0)
FROM `Utilisateur` AS account
CROSS JOIN `OperationCategoryTemplate` AS template
WHERE template.`active` = true;

-- Preserve every legacy category actually referenced by a user, including
-- custom values not present in the default catalogue.
INSERT IGNORE INTO `OperationCategory`
    (`name`, `color`, `userId`, `templateId`, `createdAt`, `updatedAt`)
SELECT
    category.`categorie`,
    NULL,
    operation.`userId`,
    NULL,
    MIN(operation.`created_at`),
    MAX(operation.`updated_at`)
FROM `Operation` AS operation
INNER JOIN `Categorie` AS category ON category.`id` = operation.`idCategorie`
GROUP BY operation.`userId`, category.`categorie`;

-- Only non-periodic legacy rows become one-off operations. The legacy id keeps
-- the backfill traceable and prevents duplicate copies in corrective scripts.
INSERT INTO `OneOffOperationRecord`
    (`legacyOperationId`, `title`, `amount`, `currency`, `type`, `operationDate`, `userId`, `categoryId`, `createdAt`, `updatedAt`)
SELECT
    operation.`id`,
    operation.`titre`,
    operation.`montant`,
    UPPER(operation.`devise`),
    operation.`type`,
    operation.`dateOperation`,
    operation.`userId`,
    personalCategory.`id`,
    operation.`created_at`,
    operation.`updated_at`
FROM `Operation` AS operation
INNER JOIN `Categorie` AS category ON category.`id` = operation.`idCategorie`
INNER JOIN `OperationCategory` AS personalCategory
    ON personalCategory.`userId` = operation.`userId`
    AND personalCategory.`name` = category.`categorie`
LEFT JOIN `Periodique` AS periodic ON periodic.`idPeriodique` = operation.`id`
WHERE periodic.`idPeriodique` IS NULL;
