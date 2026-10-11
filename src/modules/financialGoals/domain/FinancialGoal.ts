export type FinancialGoalProps = Readonly<{
  id?: number;
  ownerId: number;
  title: string;
  targetAmount: string | number;
  savedAmount: string | number;
  monthlyContribution: string | number;
  currency: string;
  targetDate?: string | null;
}>;

export type FinancialGoalErrorCode =
  | "INVALID_ID"
  | "INVALID_OWNER_ID"
  | "INVALID_TITLE"
  | "INVALID_TARGET_AMOUNT"
  | "INVALID_SAVED_AMOUNT"
  | "INVALID_MONTHLY_CONTRIBUTION"
  | "INVALID_CURRENCY"
  | "INVALID_TARGET_DATE"
  | "INVALID_REFERENCE_DATE";

export class FinancialGoalError extends Error {
  public constructor(public readonly code: FinancialGoalErrorCode) {
    super(code);
    this.name = "FinancialGoalError";
  }
}

export type FinancialGoalStatus =
  | "REACHED"
  | "NO_DEADLINE"
  | "ON_TRACK"
  | "BEHIND"
  | "MISSED";

export type FinancialGoalForecast = Readonly<{
  referenceMonth: string;
  remainingMinorUnits: number;
  status: FinancialGoalStatus;
  contributionsNeeded: number | null;
  estimatedReachMonth: string | null;
  requiredMonthlyMinorUnits: number | null;
}>;

/** Au-delà de 100 ans, une date estimée n'a plus de sens pour l'utilisateur. */
export const MAX_FORECAST_MONTHS = 1200;

const parseCivilDate = (
  value: string,
  code: "INVALID_TARGET_DATE" | "INVALID_REFERENCE_DATE"
): void => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match == null) throw new FinancialGoalError(code);
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new FinancialGoalError(code);
  }
};

const minorUnitsOf = (
  amount: string | number,
  code: Extract<
    FinancialGoalErrorCode,
    | "INVALID_TARGET_AMOUNT"
    | "INVALID_SAVED_AMOUNT"
    | "INVALID_MONTHLY_CONTRIBUTION"
  >,
  allowZero: boolean
): number => {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(
    String(amount).trim()
  );
  if (match == null) throw new FinancialGoalError(code);
  const value =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0))
    throw new FinancialGoalError(code);
  return value;
};

const monthIndex = (civilDate: string): number =>
  Number(civilDate.slice(0, 4)) * 12 + Number(civilDate.slice(5, 7)) - 1;

const monthOf = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(
    (index % 12) + 1
  ).padStart(2, "0")}`;

const ceilDiv = (dividend: number, divisor: number): number =>
  Math.floor((dividend + divisor - 1) / divisor);

export class FinancialGoal {
  public readonly id?: number;
  public readonly ownerId: number;
  public readonly title: string;
  public readonly targetMinorUnits: number;
  public readonly savedMinorUnits: number;
  public readonly monthlyContributionMinorUnits: number;
  public readonly currency: string;
  public readonly targetDate: string | null;

  private constructor(
    props: FinancialGoalProps,
    amounts: readonly [number, number, number]
  ) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.title = props.title.trim();
    [
      this.targetMinorUnits,
      this.savedMinorUnits,
      this.monthlyContributionMinorUnits,
    ] = amounts;
    this.currency = props.currency.trim().toUpperCase();
    this.targetDate = props.targetDate ?? null;
  }

  public static create(props: FinancialGoalProps): FinancialGoal {
    if (props.id !== undefined) this.assertId(props.id, "INVALID_ID");
    this.assertId(props.ownerId, "INVALID_OWNER_ID");
    if (
      typeof props.title !== "string" ||
      props.title.trim().length < 2 ||
      props.title.trim().length > 50
    ) {
      throw new FinancialGoalError("INVALID_TITLE");
    }
    if (
      typeof props.currency !== "string" ||
      !/^[A-Z]{3}$/.test(props.currency.trim().toUpperCase())
    ) {
      throw new FinancialGoalError("INVALID_CURRENCY");
    }
    if (props.targetDate != null) {
      parseCivilDate(props.targetDate, "INVALID_TARGET_DATE");
    }
    return new FinancialGoal(props, [
      minorUnitsOf(props.targetAmount, "INVALID_TARGET_AMOUNT", false),
      minorUnitsOf(props.savedAmount, "INVALID_SAVED_AMOUNT", true),
      minorUnitsOf(
        props.monthlyContribution,
        "INVALID_MONTHLY_CONTRIBUTION",
        true
      ),
    ]);
  }

  /**
   * Projette l'objectif depuis la date civile de référence. Le montant déjà
   * épargné est l'état courant : le premier versement futur tombe le mois
   * suivant le mois de référence.
   */
  public forecast(today: string): FinancialGoalForecast {
    parseCivilDate(today, "INVALID_REFERENCE_DATE");
    const reference = monthIndex(today);
    const referenceMonth = monthOf(reference);
    const remaining = Math.max(0, this.targetMinorUnits - this.savedMinorUnits);
    if (remaining === 0) {
      return {
        referenceMonth,
        remainingMinorUnits: 0,
        status: "REACHED",
        contributionsNeeded: 0,
        estimatedReachMonth: referenceMonth,
        requiredMonthlyMinorUnits: null,
      };
    }

    const contribution = this.monthlyContributionMinorUnits;
    const needed = contribution === 0 ? null : ceilDiv(remaining, contribution);
    const estimatedReachMonth =
      needed === null || needed > MAX_FORECAST_MONTHS
        ? null
        : monthOf(reference + needed);

    if (this.targetDate === null) {
      return {
        referenceMonth,
        remainingMinorUnits: remaining,
        status: "NO_DEADLINE",
        contributionsNeeded: needed,
        estimatedReachMonth,
        requiredMonthlyMinorUnits: null,
      };
    }

    const monthsAvailable = monthIndex(this.targetDate) - reference;
    if (monthsAvailable <= 0) {
      return {
        referenceMonth,
        remainingMinorUnits: remaining,
        status: "MISSED",
        contributionsNeeded: needed,
        estimatedReachMonth,
        requiredMonthlyMinorUnits: null,
      };
    }
    return {
      referenceMonth,
      remainingMinorUnits: remaining,
      status:
        needed !== null && needed <= monthsAvailable ? "ON_TRACK" : "BEHIND",
      contributionsNeeded: needed,
      estimatedReachMonth,
      requiredMonthlyMinorUnits: ceilDiv(remaining, monthsAvailable),
    };
  }

  private static assertId(
    value: number,
    code: "INVALID_ID" | "INVALID_OWNER_ID"
  ): void {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new FinancialGoalError(code);
  }
}
