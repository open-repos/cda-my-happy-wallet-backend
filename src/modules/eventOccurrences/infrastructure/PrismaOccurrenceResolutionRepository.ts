import {
  MonthlyEventKind,
  OccurrenceResolutionStatus,
  Prisma,
  PrismaClient,
  TypeOperationEnum,
} from "@prisma/client";
import { OneOffOperation } from "../../operations/domain";
import {
  OccurrenceResolutionConflict,
  OccurrenceResolutionRepository,
} from "../application";
import { OccurrenceResolution, OccurrenceSnapshot } from "../domain";

type DecimalValue = { toFixed(fractionDigits: number): string };

type ResolutionRow = Readonly<{
  id: number;
  userId: number;
  sourceEventId: number;
  occurrenceDate: Date;
  status: OccurrenceResolutionStatus;
  title: string;
  amount: DecimalValue;
  currency: string;
  kind: MonthlyEventKind;
  resolvedAt: Date;
  operation: Readonly<{
    id: number;
    title: string;
    amount: DecimalValue;
    operationDate: Date;
    categoryId: number;
  }> | null;
}>;

const operationSelect = {
  select: {
    id: true,
    title: true,
    amount: true,
    operationDate: true,
    categoryId: true,
  },
} as const;

const minorUnitsOf = (value: DecimalValue): number =>
  Math.round(Number(value.toFixed(2)) * 100);
const decimalOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);
const dateOf = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const civilDateOf = (value: Date): string => value.toISOString().slice(0, 10);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export class PrismaOccurrenceResolutionRepository
  implements OccurrenceResolutionRepository
{
  public constructor(private readonly prisma: PrismaClient) {}

  public async find(
    ownerId: number,
    sourceEventId: number,
    occurrenceDate: string
  ): Promise<OccurrenceResolution | null> {
    const row = await this.prisma.eventOccurrenceResolution.findUnique({
      where: {
        userId_sourceEventId_occurrenceDate: {
          userId: ownerId,
          sourceEventId,
          occurrenceDate: dateOf(occurrenceDate),
        },
      },
      include: { operation: operationSelect },
    });
    return row == null ? null : this.toDomain(row);
  }

  public async realize(
    snapshot: OccurrenceSnapshot,
    operation: OneOffOperation
  ): Promise<OccurrenceResolution> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.oneOffOperationRecord.create({
          data: {
            title: operation.title,
            amount: decimalOf(operation.money.minorUnits),
            currency: operation.money.currency,
            type:
              operation.kind === "ENTREE"
                ? TypeOperationEnum.ENTREE
                : TypeOperationEnum.DEPENSE,
            operationDate: dateOf(operation.operationDate),
            userId: operation.ownerId,
            categoryId: operation.categoryId,
          },
        });
        return tx.eventOccurrenceResolution.create({
          data: {
            ...this.snapshotData(snapshot),
            status: OccurrenceResolutionStatus.REALIZED,
            operationId: created.id,
          },
          include: { operation: operationSelect },
        });
      });
      return this.toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new OccurrenceResolutionConflict();
      throw error;
    }
  }

  public async cancel(
    snapshot: OccurrenceSnapshot
  ): Promise<OccurrenceResolution> {
    try {
      return this.toDomain(
        await this.prisma.eventOccurrenceResolution.create({
          data: {
            ...this.snapshotData(snapshot),
            status: OccurrenceResolutionStatus.CANCELED,
          },
          include: { operation: operationSelect },
        })
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new OccurrenceResolutionConflict();
      throw error;
    }
  }

  private snapshotData(snapshot: OccurrenceSnapshot) {
    return {
      userId: snapshot.ownerId,
      sourceEventId: snapshot.sourceEventId,
      occurrenceDate: dateOf(snapshot.occurrenceDate),
      title: snapshot.title,
      amount: decimalOf(snapshot.minorUnits),
      currency: snapshot.currency,
      kind: snapshot.kind,
    };
  }

  private toDomain(row: ResolutionRow): OccurrenceResolution {
    return {
      id: row.id,
      ownerId: row.userId,
      sourceEventId: row.sourceEventId,
      occurrenceDate: civilDateOf(row.occurrenceDate),
      status: row.status,
      title: row.title,
      minorUnits: minorUnitsOf(row.amount),
      currency: row.currency,
      kind: row.kind,
      resolvedAt: row.resolvedAt,
      operation:
        row.operation == null
          ? null
          : {
              id: row.operation.id,
              title: row.operation.title,
              minorUnits: minorUnitsOf(row.operation.amount),
              operationDate: civilDateOf(row.operation.operationDate),
              categoryId: row.operation.categoryId,
            },
    };
  }
}
