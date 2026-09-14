export type OneOffOperationKind = "DEPENSE" | "ENTREE";

export type OperationCategoryReference = Readonly<{
  id: number;
  ownerId: number;
}>;

export type CreateOneOffOperationProps = Readonly<{
  id?: number;
  ownerId: number;
  title: string;
  amount: string | number;
  currency: string;
  kind: OneOffOperationKind;
  operationDate: string;
  category: OperationCategoryReference;
}>;

export type OneOffOperationErrorCode =
  | "INVALID_ID"
  | "INVALID_OWNER_ID"
  | "INVALID_CATEGORY_ID"
  | "CATEGORY_OWNER_MISMATCH"
  | "INVALID_TITLE"
  | "INVALID_AMOUNT"
  | "INVALID_CURRENCY"
  | "INVALID_KIND"
  | "INVALID_OPERATION_DATE";

export class OneOffOperationError extends Error {
  public readonly code: OneOffOperationErrorCode;

  public constructor(code: OneOffOperationErrorCode) {
    super(code);
    this.name = "OneOffOperationError";
    this.code = code;
  }
}

export class Money {
  public readonly minorUnits: number;
  public readonly currency: string;

  private constructor(minorUnits: number, currency: string) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  public static create(amount: string | number, currency: string): Money {
    if (typeof currency !== "string") {
      throw new OneOffOperationError("INVALID_CURRENCY");
    }

    const minorUnits = this.parseMinorUnits(amount);
    const normalizedCurrency = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new OneOffOperationError("INVALID_CURRENCY");
    }

    return new Money(minorUnits, normalizedCurrency);
  }

  private static parseMinorUnits(amount: string | number): number {
    const normalizedAmount = String(amount).trim();
    const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(normalizedAmount);

    if (match == null) {
      throw new OneOffOperationError("INVALID_AMOUNT");
    }

    const fraction = (match[2] ?? "").padEnd(2, "0");
    const minorUnits = Number(match[1]) * 100 + Number(fraction || "0");

    if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
      throw new OneOffOperationError("INVALID_AMOUNT");
    }

    return minorUnits;
  }
}

export class OneOffOperation {
  public readonly id?: number;
  public readonly ownerId: number;
  public readonly title: string;
  public readonly money: Money;
  public readonly kind: OneOffOperationKind;
  public readonly operationDate: string;
  public readonly categoryId: number;

  private constructor(
    props: Omit<CreateOneOffOperationProps, "amount" | "currency" | "category">,
    money: Money,
    categoryId: number
  ) {
    this.id = props.id;
    this.ownerId = props.ownerId;
    this.title = props.title.trim();
    this.money = money;
    this.kind = props.kind;
    this.operationDate = props.operationDate;
    this.categoryId = categoryId;
  }

  public static create(props: CreateOneOffOperationProps): OneOffOperation {
    this.assertOptionalId(props.id);
    this.assertPositiveId(props.ownerId, "INVALID_OWNER_ID");
    this.assertPositiveId(props.category.id, "INVALID_CATEGORY_ID");

    if (props.category.ownerId !== props.ownerId) {
      throw new OneOffOperationError("CATEGORY_OWNER_MISMATCH");
    }

    if (typeof props.title !== "string") {
      throw new OneOffOperationError("INVALID_TITLE");
    }

    const normalizedTitle = props.title.trim();
    if (normalizedTitle.length < 2 || normalizedTitle.length > 50) {
      throw new OneOffOperationError("INVALID_TITLE");
    }

    if (props.kind !== "DEPENSE" && props.kind !== "ENTREE") {
      throw new OneOffOperationError("INVALID_KIND");
    }

    this.assertCalendarDate(props.operationDate);

    return new OneOffOperation(
      { ...props, title: normalizedTitle },
      Money.create(props.amount, props.currency),
      props.category.id
    );
  }

  private static assertOptionalId(id: number | undefined): void {
    if (id !== undefined) {
      this.assertPositiveId(id, "INVALID_ID");
    }
  }

  private static assertPositiveId(
    id: number,
    code: Extract<
      OneOffOperationErrorCode,
      "INVALID_ID" | "INVALID_OWNER_ID" | "INVALID_CATEGORY_ID"
    >
  ): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new OneOffOperationError(code);
    }
  }

  private static assertCalendarDate(value: string): void {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match == null) {
      throw new OneOffOperationError("INVALID_OPERATION_DATE");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new OneOffOperationError("INVALID_OPERATION_DATE");
    }
  }
}
