export type MonthlyEventKind = "DEPENSE" | "ENTREE";
export type MonthlyEventRecurrence = "AUCUNE" | "MENSUELLE";

export type MonthlyEventProps = Readonly<{
  id?: number;
  ownerId: number;
  title: string;
  amount: string | number;
  currency: string;
  kind: MonthlyEventKind;
  startDate: string;
  recurrence: MonthlyEventRecurrence;
  endDate?: string | null;
}>;

export type MonthlyEventErrorCode =
  | "INVALID_ID"
  | "INVALID_OWNER_ID"
  | "INVALID_TITLE"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_KIND"
  | "INVALID_START_DATE"
  | "INVALID_RECURRENCE"
  | "INVALID_END_DATE";

export class MonthlyEventError extends Error {
  public constructor(public readonly code: MonthlyEventErrorCode) {
    super(code);
    this.name = "MonthlyEventError";
  }
}

const parseDate = (
  value: string,
  code: "INVALID_START_DATE" | "INVALID_END_DATE"
): readonly [number, number, number] => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match == null) throw new MonthlyEventError(code);
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) {
    throw new MonthlyEventError(code);
  }
  return parts;
};

const minorUnitsOf = (amount: string | number): number => {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(
    String(amount).trim()
  );
  if (match == null) throw new MonthlyEventError("INVALID_AMOUNT");
  const value =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new MonthlyEventError("INVALID_AMOUNT");
  }
  return value;
};

export class MonthlyEvent {
  public readonly id?: number;
  public readonly ownerId: number;
  public readonly title: string;
  public readonly minorUnits: number;
  public readonly currency: string;
  public readonly kind: MonthlyEventKind;
  public readonly startDate: string;
  public readonly recurrence: MonthlyEventRecurrence;
  public readonly endDate: string | null;

  private constructor(props: MonthlyEventProps, minorUnits: number) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.title = props.title.trim();
    this.minorUnits = minorUnits;
    this.currency = props.currency.trim().toUpperCase();
    this.kind = props.kind;
    this.startDate = props.startDate;
    this.recurrence = props.recurrence;
    this.endDate = props.endDate ?? null;
  }

  public static create(props: MonthlyEventProps): MonthlyEvent {
    if (props.id !== undefined) this.assertId(props.id, "INVALID_ID");
    this.assertId(props.ownerId, "INVALID_OWNER_ID");
    if (
      typeof props.title !== "string" ||
      props.title.trim().length < 2 ||
      props.title.trim().length > 50
    ) {
      throw new MonthlyEventError("INVALID_TITLE");
    }
    if (
      typeof props.currency !== "string" ||
      !/^[A-Z]{3}$/.test(props.currency.trim().toUpperCase())
    ) {
      throw new MonthlyEventError("INVALID_CURRENCY");
    }
    if (props.kind !== "DEPENSE" && props.kind !== "ENTREE") {
      throw new MonthlyEventError("INVALID_KIND");
    }
    if (props.recurrence !== "AUCUNE" && props.recurrence !== "MENSUELLE") {
      throw new MonthlyEventError("INVALID_RECURRENCE");
    }
    parseDate(props.startDate, "INVALID_START_DATE");
    const endDate = props.endDate ?? null;
    if (endDate !== null) {
      parseDate(endDate, "INVALID_END_DATE");
      if (props.recurrence === "AUCUNE" || endDate < props.startDate) {
        throw new MonthlyEventError("INVALID_END_DATE");
      }
    }
    return new MonthlyEvent(props, minorUnitsOf(props.amount));
  }

  public occurrenceIn(month: string): string | null {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (match == null) throw new MonthlyEventError("INVALID_START_DATE");
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    if (monthNumber < 1 || monthNumber > 12) {
      throw new MonthlyEventError("INVALID_START_DATE");
    }
    const monthStart = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    if (this.recurrence === "AUCUNE") {
      return this.startDate >= monthStart && this.startDate <= monthEnd
        ? this.startDate
        : null;
    }
    if (this.startDate > monthEnd) return null;
    const anchorDay = Number(this.startDate.slice(8, 10));
    const occurrence = `${month}-${String(
      Math.min(anchorDay, lastDay)
    ).padStart(2, "0")}`;
    if (
      occurrence < this.startDate ||
      (this.endDate !== null && occurrence > this.endDate)
    ) {
      return null;
    }
    return occurrence;
  }

  private static assertId(
    value: number,
    code: "INVALID_ID" | "INVALID_OWNER_ID"
  ): void {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new MonthlyEventError(code);
  }
}

export type MonthlyEventOccurrence = Readonly<{
  event: MonthlyEvent;
  occurrenceDate: string;
}>;
