import assert from "assert";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import {
  BudgetPeriodRepository,
  BudgetPeriodState,
} from "../../../src/modules/budgetPeriods/application";
import {
  BudgetMovement,
  PlannedMovement,
} from "../../../src/modules/budgetPeriods/domain";

export class ForecastReads
  implements
    Pick<
      BudgetPeriodRepository,
      | "find"
      | "firstActivityMonth"
      | "listFrom"
      | "fixedTotals"
      | "actualMovements"
      | "plannedMovements"
      | "goalSavings"
    >
{
  public periods: BudgetPeriodState[] = [];
  public origin: string | null = null;
  public actual: Record<string, BudgetMovement[]> = {};
  public planned: Record<string, PlannedMovement[]> = {};
  public calls: Array<readonly [number, string]> = [];
  public fixed = { incomeMinorUnits: 10000, expenseMinorUnits: 2000 };
  public savings = 1000;
  private record(owner: number, currency: string) {
    this.calls.push([owner, currency]);
  }
  public async find(owner: number, month: string, currency: string) {
    this.record(owner, currency);
    return this.periods.find((p) => p.month === month) ?? null;
  }
  public async firstActivityMonth(owner: number, currency: string) {
    this.record(owner, currency);
    return this.origin;
  }
  public async listFrom(owner: number, currency: string, month: string) {
    this.record(owner, currency);
    return this.periods.filter((p) => p.month >= month);
  }
  public async fixedTotals(owner: number, currency: string) {
    this.record(owner, currency);
    return this.fixed;
  }
  public async actualMovements(owner: number, month: string, currency: string) {
    this.record(owner, currency);
    return this.actual[month] ?? [];
  }
  public async plannedMovements(
    owner: number,
    month: string,
    currency: string
  ) {
    this.record(owner, currency);
    return this.planned[month] ?? [];
  }
  public async goalSavings(owner: number, currency: string) {
    this.record(owner, currency);
    return this.savings;
  }
}

const run = async () => {
  const repo = new ForecastReads();
  repo.actual["2026-10"] = [
    { operationDate: "2026-10-01", kind: "DEPENSE", minorUnits: 2000 },
  ];
  repo.planned["2026-10"] = [
    {
      occurrenceDate: "2026-10-31",
      kind: "DEPENSE",
      minorUnits: 6000,
      count: 1,
    },
  ];
  repo.planned["2026-11"] = [
    { occurrenceDate: "2026-11-05", kind: "ENTREE", minorUnits: 500, count: 1 },
  ];
  const service = new BudgetForecastService(repo);
  const result = await service.forecast(7, "2026-10", 3, "eur", "2026-10-31");
  assert.strictEqual(result.currentRealRemainingMinorUnits, 6000);
  assert.deepStrictEqual(
    result.months.map((m) => m.forecastRemainingMinorUnits),
    [-1000, 6500, 13500]
  );
  assert.deepStrictEqual(
    result.months.map((m) => m.carryInMinorUnits),
    [6000, -1000, 6500]
  );
  assert.deepStrictEqual(
    result.months.map((m) => m.forecastResultMinorUnits),
    [-7000, 7500, 7000]
  );
  assert.deepStrictEqual(
    result.months.map((m) => m.remainingDays),
    [1, 30, 31]
  );
  assert.strictEqual(result.months[0].prudentDailyAllowanceMinorUnits, -1000);
  assert.strictEqual(result.months[0].prudentWeeklyAllowanceMinorUnits, -1000);
  assert.strictEqual(result.months[1].prudentWeeklyAllowanceMinorUnits, 1517);
  assert.ok(
    repo.calls.every(([owner, currency]) => owner === 7 && currency === "EUR")
  );
  // Future windows include intervening months without charging today's base twice.
  const future = await service.forecast(7, "2026-12", 1, "EUR", "2026-10-31");
  assert.strictEqual(future.months[0].forecastRemainingMinorUnits, 13500);
  const leap = await service.forecast(7, "2028-02", 1, "EUR", "2026-10-31");
  assert.strictEqual(leap.months[0].remainingDays, 29);
  // Missing historical periods are computed in memory, including negative carry.
  repo.origin = "2026-08";
  repo.actual["2026-08"] = [
    { operationDate: "2026-08-02", kind: "DEPENSE", minorUnits: 20000 },
  ];
  const history = await service.forecast(7, "2026-10", 1, "EUR", "2026-10-31");
  assert.strictEqual(history.currentRealRemainingMinorUnits, 2000);
  assert.strictEqual(history.months[0].forecastRemainingMinorUnits, -5000);
  // A closed snapshot anchors the carry; missing months inherit its fixed totals.
  const state: BudgetPeriodState = {
    id: 1,
    ownerId: 7,
    month: "2026-08",
    currency: "EUR",
    status: "CLOSED",
    fixedIncomeMinorUnits: 5000,
    fixedExpenseMinorUnits: 1000,
    actualIncomeMinorUnits: 0,
    actualExpenseMinorUnits: 20000,
    realRemainingMinorUnits: -16000,
    carryInMinorUnits: 0,
    unresolvedEvents: 0,
    revision: 1,
    closedAt: new Date(),
    correctedAt: null,
  };
  repo.periods = [state];
  const persisted = await service.forecast(
    7,
    "2026-10",
    1,
    "EUR",
    "2026-10-31"
  );
  assert.strictEqual(persisted.currentRealRemainingMinorUnits, -6000);
  assert.strictEqual(persisted.months[0].forecastRemainingMinorUnits, -13000);
  repo.periods.push({
    ...state,
    id: 2,
    month: "2026-10",
    status: "OPEN",
    carryInMinorUnits: 1234,
  });
  const opened = await service.forecast(7, "2026-10", 1, "EUR", "2026-10-31");
  assert.strictEqual(opened.currentRealRemainingMinorUnits, 7234);
  assert.strictEqual(repo.periods[1].revision, 1);
  // Bounded windows, invalid owners/currencies and amounts fail before any projection.
  for (const count of [0, -1, 25, 1.5, NaN]) {
    await assert.rejects(
      service.forecast(7, "2026-10", count, "EUR", "2026-10-31")
    );
  }
  await assert.rejects(service.forecast(0, "2026-10", 1, "EUR", "2026-10-31"));
  await assert.rejects(service.forecast(7, "2026-09", 1, "EUR", "2026-10-31"));
  await assert.rejects(service.forecast(7, "2030-01", 1, "EUR", "2026-10-31"));
  await assert.rejects(service.forecast(7, "2026-10", 1, "EU", "2026-10-31"));
  repo.fixed.incomeMinorUnits = Number.MAX_SAFE_INTEGER;
  await assert.rejects(service.forecast(7, "2026-10", 24, "EUR", "2026-10-31"));
};

if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
