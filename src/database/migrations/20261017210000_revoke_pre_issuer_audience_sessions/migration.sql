-- One-time session cutover for mandatory JWT issuer and purpose audiences.
-- Existing refresh tokens have no such claims and cannot be renewed.
-- Do not undo revocation on application rollback: users must log in again.
UPDATE `RefreshSession`
SET `revokedAt` = CURRENT_TIMESTAMP(3), `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `revokedAt` IS NULL;
