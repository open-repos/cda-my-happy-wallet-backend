-- Old closed snapshots retain their financial result. No historical recalculation.
ALTER TABLE `BudgetPeriod`
  ADD COLUMN `reconciliationAdjustment` DECIMAL(14, 2) NOT NULL DEFAULT 0;
