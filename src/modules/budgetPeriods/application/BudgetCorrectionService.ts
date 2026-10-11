import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { BudgetPeriodEngine } from "./BudgetPeriodEngine";

/** Date et devise touchées par une écriture d'opération ponctuelle. */
export type OperationChange = Readonly<{
  operationDate: string;
  currency: string;
}>;

/**
 * Après une écriture dans un mois passé, recalcule chaque devise touchée à
 * partir de son mois le plus ancien. Le mois courant est toujours calculé à la
 * lecture et ne demande aucun recalcul.
 */
export class BudgetCorrectionService {
  public constructor(
    private readonly engine: Pick<BudgetPeriodEngine, "recalculateFrom">,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async afterOperationChange(
    ownerId: number,
    changes: readonly OperationChange[]
  ): Promise<void> {
    const today = this.today();
    const currentMonth = today.slice(0, 7);
    const earliest = new Map<string, string>();
    for (const change of changes) {
      const month = change.operationDate.slice(0, 7);
      const known = earliest.get(change.currency);
      if (month < currentMonth && (known === undefined || month < known)) {
        earliest.set(change.currency, month);
      }
    }
    for (const [currency, month] of earliest) {
      await this.engine.recalculateFrom(ownerId, month, currency, today);
    }
  }
}
