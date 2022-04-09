-- AlterTable
ALTER TABLE `ResteAVivre` MODIFY `montantRaV` DECIMAL(10, 0) NOT NULL DEFAULT 0,
    MODIFY `montantTotalDepense` DECIMAL(10, 0) NOT NULL DEFAULT 0,
    MODIFY `montantTotalEntree` DECIMAL(10, 0) NOT NULL DEFAULT 0;
