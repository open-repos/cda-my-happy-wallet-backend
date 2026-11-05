import { createHash } from "crypto";
import { ReconciliationError } from "../../reconciliation/domain/Reconciliation";
import {
  applyReconciliationLink,
  guardLinkedOperation,
  lockReconciliationOwner,
} from "../../reconciliation/infrastructure/reconciliationLocks";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { Prisma, PrismaClient, TypeOperationEnum } from "@prisma/client";
import {
  OneOffOperationRepository,
  OperationApplicationError,
  OperationListFilter,
  OperationListSort,
  OperationReconciliationInput,
  OperationSortField,
} from "../application";
import { OneOffOperation } from "../domain";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  CursorValue,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";

type OperationRow = Readonly<{
  id: number;
  title: string;
  amount: { toFixed(fractionDigits: number): string };
  currency: string;
  type: TypeOperationEnum;
  operationDate: Date;
  userId: number;
  category: { id: number; userId: number };
}>;

type ListedRow = OperationRow & Readonly<{ category: { name: string } }>;
type Comparison = "gt" | "lt";
type Where = Prisma.OneOffOperationRecordWhereInput;

/** Colonne triée, son ordre SQL et la valeur gardée dans le curseur. */
type SortStrategy = Readonly<{
  orderBy: (
    order: "asc" | "desc"
  ) => Prisma.OneOffOperationRecordOrderByWithRelationInput[];
  positionOf: (row: ListedRow) => string;
  isValue: (value: string) => boolean;
  compare: (value: string, comparison: Comparison) => Where;
  equals: (value: string) => Where;
}>;

const civilDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const isCivilDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(civilDate(value).getTime());
/** `VarChar(50)` compte des caractères, pas des unités UTF-16. */
const isText = (value: string): boolean =>
  value.length > 0 && [...value].length <= 50;

const SORT_STRATEGIES: Readonly<Record<OperationSortField, SortStrategy>> = {
  date: {
    orderBy: (order) => [{ operationDate: order }],
    positionOf: (row) => row.operationDate.toISOString().slice(0, 10),
    isValue: isCivilDate,
    compare: (value, comparison) => ({
      operationDate: { [comparison]: civilDate(value) },
    }),
    equals: (value) => ({ operationDate: civilDate(value) }),
  },
  title: {
    orderBy: (order) => [{ title: order }],
    positionOf: (row) => row.title,
    isValue: isText,
    compare: (value, comparison) => ({ title: { [comparison]: value } }),
    equals: (value) => ({ title: value }),
  },
  category: {
    orderBy: (order) => [{ category: { name: order } }],
    positionOf: (row) => row.category.name,
    isValue: isText,
    compare: (value, comparison) => ({
      category: { is: { name: { [comparison]: value } } },
    }),
    equals: (value) => ({ category: { is: { name: value } } }),
  },
  amount: {
    orderBy: (order) => [{ amount: order }],
    positionOf: (row) => row.amount.toFixed(2),
    isValue: (value) => /^(0|[1-9]\d{0,7})\.\d{2}$/.test(value),
    compare: (value, comparison) => ({ amount: { [comparison]: value } }),
    equals: (value) => ({ amount: value }),
  },
};

/** `%`, `_` et `\\` sont cherchés littéralement dans un `LIKE`. */
const likeLiteral = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

/**
 * Tous les filtres liés au curseur, dans un ordre fixe. Le type impose d'y
 * inscrire chaque champ de `OperationListFilter` : un filtre ajouté plus tard
 * ne peut pas être oublié dans l'empreinte du curseur.
 */
const LIST_FILTER_FIELDS = {
  from: 0,
  to: 1,
  currency: 2,
  title: 3,
  categoryIds: 4,
  kind: 5,
  minAmount: 6,
  maxAmount: 7,
} satisfies Record<keyof OperationListFilter, number>;
const LIST_FILTER_KEYS = (
  Object.keys(LIST_FILTER_FIELDS) as (keyof OperationListFilter)[]
).sort((a, b) => LIST_FILTER_FIELDS[a] - LIST_FILTER_FIELDS[b]);

const listFilterConditions = (filter: OperationListFilter): Where[] => [
  ...(filter.currency === undefined ? [] : [{ currency: filter.currency }]),
  ...(filter.from === undefined
    ? []
    : [{ operationDate: { gte: civilDate(filter.from) } }]),
  ...(filter.to === undefined
    ? []
    : [{ operationDate: { lte: civilDate(filter.to) } }]),
  ...(filter.title === undefined
    ? []
    : [{ title: { contains: likeLiteral(filter.title) } }]),
  ...(filter.categoryIds === undefined
    ? []
    : [{ categoryId: { in: [...filter.categoryIds] } }]),
  ...(filter.kind === undefined ? [] : [{ type: filter.kind }]),
  ...(filter.minAmount === undefined
    ? []
    : [{ amount: { gte: filter.minAmount } }]),
  ...(filter.maxAmount === undefined
    ? []
    : [{ amount: { lte: filter.maxAmount } }]),
];

export class PrismaOneOffOperationRepository
  implements OneOffOperationRepository
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest,
    filter: OperationListFilter = {},
    sort?: OperationListSort
  ): Promise<CursorPage<OneOffOperation>> {
    const context = this.cursorContext(ownerId, filter, sort);
    const strategy = SORT_STRATEGIES[sort?.field ?? "date"];
    const order = sort?.order ?? "desc";
    const after =
      pagination.cursor == null
        ? null
        : this.decodePosition(
            this.cursors.decode(context, pagination.cursor),
            strategy
          );
    const conditions: Prisma.OneOffOperationRecordWhereInput[] = [
      { userId: ownerId },
      ...listFilterConditions(filter),
    ];
    if (after !== null) {
      const comparison = order === "asc" ? "gt" : "lt";
      conditions.push({
        OR: [
          strategy.compare(after.value, comparison),
          { AND: [strategy.equals(after.value), { id: { [comparison]: after.id } }] },
        ],
      });
    }
    const rows = await this.prisma.oneOffOperationRecord.findMany({
      where: { AND: conditions },
      include: {
        category: { select: { id: true, userId: true, name: true } },
      },
      orderBy: [...strategy.orderBy(order), { id: order }],
      take: pagination.limit + 1,
    });
    const page = createCursorPage(
      rows,
      pagination,
      context,
      (row) => [strategy.positionOf(row), row.id],
      this.cursors
    );
    return { data: page.data.map((row) => this.toDomain(row)), meta: page.meta };
  }

  private decodePosition(
    position: readonly CursorValue[],
    strategy: SortStrategy
  ): { value: string; id: number } {
    const [value, id] = position;
    if (
      position.length !== 2 ||
      typeof value !== "string" ||
      !strategy.isValue(value) ||
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw invalidPagination();
    }
    return { value, id };
  }

  public async listTitleSuggestions(
    ownerId: number,
    pagination: PaginationRequest,
    query?: string
  ): Promise<CursorPage<string>> {
    const search = query === "" ? undefined : query;
    const context = this.suggestionCursorContext(ownerId, search);
    const after =
      pagination.cursor == null
        ? null
        : this.decodeTitlePosition(
            this.cursors.decode(context, pagination.cursor)
          );
    const conditions: Where[] = [
      { userId: ownerId },
      ...(search === undefined
        ? []
        : [{ title: { contains: likeLiteral(search) } }]),
      ...(after === null ? [] : [{ title: { gt: after } }]),
    ];
    // `GROUP BY title` suit le classement de la colonne : chaque groupe réunit
    // les variantes à la casse ou aux accents près, et `title > curseur`
    // utilise la même égalité, ce qui évite doublons et omissions.
    const rows = await this.prisma.oneOffOperationRecord.groupBy({
      by: ["title"],
      where: { AND: conditions },
      orderBy: { title: "asc" },
      take: pagination.limit + 1,
    });
    return createCursorPage(
      rows.map((row) => row.title),
      pagination,
      context,
      (title) => [title],
      this.cursors
    );
  }

  private decodeTitlePosition(position: readonly CursorValue[]): string {
    const [title] = position;
    if (position.length !== 1 || typeof title !== "string" || !isText(title)) {
      throw invalidPagination();
    }
    return title;
  }

  /** Le curseur des suggestions est lié au propriétaire et au texte cherché. */
  private suggestionCursorContext(
    ownerId: number,
    query: string | undefined
  ): CursorContext {
    const resource = "one-off-operation-title-suggestions";
    if (query === undefined) return { resource, scope: `owner:${ownerId}` };
    const digest = createHash("sha256").update(query, "utf8").digest("hex");
    return { resource, scope: `owner:${ownerId}:q:${digest}` };
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OneOffOperation | null> {
    const row = await this.prisma.oneOffOperationRecord.findFirst({
      where: { id, userId: ownerId },
      include: { category: { select: { id: true, userId: true } } },
    });
    return row == null ? null : this.toDomain(row);
  }

  public async create(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, operation.ownerId);
      if (reconciliation && reconciliation.expectedOccurrenceId !== null) throw new ReconciliationError("ASSOCIATION_CONFLICT");
      const created = await tx.oneOffOperationRecord.create({
        data: this.toPersistence(operation),
        include: { category: { select: { id: true, userId: true } } },
      });
      if (reconciliation)
        await applyReconciliationLink(
          tx,
          operation.ownerId,
          created.id,
          reconciliation.occurrenceId,
          reconciliation.expectedOccurrenceId,
          this.today()
        );
      return created;
    });
    return this.toDomain(row);
  }

  public async update(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation | null> {
    if (operation.id == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }

    return this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, operation.ownerId);
      const before = await tx.oneOffOperationRecord.findFirst({
        where: { id: operation.id, userId: operation.ownerId },
      });
      if (!before) return null;
      await guardLinkedOperation(
        tx,
        operation.ownerId,
        operation.id!,
        reconciliation === undefined
          ? {
              operationDate: operation.operationDate,
              currency: operation.money.currency,
              kind: operation.kind,
            }
          : undefined,
        this.today()
      );
      const updated = await tx.oneOffOperationRecord.update({
        where: { id: operation.id },
        data: this.toPersistence(operation),
        include: { category: { select: { id: true, userId: true } } },
      });
      if (reconciliation)
        await applyReconciliationLink(
          tx,
          operation.ownerId,
          operation.id!,
          reconciliation.occurrenceId,
          reconciliation.expectedOccurrenceId,
          this.today()
        );
      return this.toDomain(updated);
    });
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, ownerId);
      await guardLinkedOperation(tx, ownerId, id, undefined, this.today());
      return tx.oneOffOperationRecord.deleteMany({
        where: { id, userId: ownerId },
      });
    });
    return result.count === 1;
  }

  private toPersistence(operation: OneOffOperation) {
    return {
      title: operation.title,
      amount: (operation.money.minorUnits / 100).toFixed(2),
      currency: operation.money.currency,
      type: operation.kind,
      operationDate: new Date(`${operation.operationDate}T00:00:00.000Z`),
      userId: operation.ownerId,
      categoryId: operation.categoryId,
    };
  }

  private toDomain(row: OperationRow): OneOffOperation {
    return OneOffOperation.create({
      id: row.id,
      ownerId: row.userId,
      title: row.title,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      kind: row.type,
      operationDate: row.operationDate.toISOString().slice(0, 10),
      category: { id: row.category.id, ownerId: row.category.userId },
    });
  }

  /**
   * Le tri et les filtres font partie du contexte : un curseur ne change pas
   * de liste. Sans tri ni filtre ajouté par #165, le périmètre reste celui
   * d'avant, ce qui garde valides les curseurs déjà émis.
   */
  private cursorContext(
    ownerId: number,
    filter: OperationListFilter = {},
    sort?: OperationListSort
  ): CursorContext {
    const resource = "one-off-operations";
    const { from, to, currency, ...added } = filter;
    const hasAdded = Object.values(added).some((value) => value !== undefined);
    if (sort === undefined && !hasAdded) {
      const filters = [from ?? "", to ?? "", currency ?? ""];
      return {
        resource,
        scope: filters.some((value) => value !== "")
          ? `owner:${ownerId}:${filters.join(":")}`
          : `owner:${ownerId}`,
      };
    }
    const canonical = JSON.stringify([
      ...LIST_FILTER_KEYS.map((key) =>
        key === "categoryIds" && filter.categoryIds !== undefined
          ? [...new Set(filter.categoryIds)].sort((a, b) => a - b)
          : filter[key] ?? null
      ),
      sort?.field ?? null,
      sort?.order ?? null,
    ]);
    const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
    return { resource, scope: `owner:${ownerId}:list:${digest}` };
  }
}
