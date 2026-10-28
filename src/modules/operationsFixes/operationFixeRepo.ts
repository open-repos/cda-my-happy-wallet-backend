import {
  assertEnvelopeFlag,
  resolvedFixedRow,
  scheduleFixedVersion,
  monthDate,
} from "./infrastructure/fixedVersions";
import { parisCivilDateClock } from "../../utils/civilDateClock";
import { reconciliationHttpError } from "../reconciliation/presentation/reconciliationError";
import { ErrorCode, ErrorException } from "../../utils/errors";
import { TypeOperationFixeEnum } from "@prisma/client";
import { OperationFixeProps } from "./../../utils/validators/operationFixe.validator";
import {
  IOperationFixeRepository,
  OperationFixeListItem,
  OperationFixeWithIdProps,
  ReadOperationFixeProps,
} from "./operationFixeRepository.interface";
import { chargeAmountFields } from "./services/fixedChargeAmounts";
import { loadFixedTotals } from "./infrastructure/loadFixedTotals";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  decodePositiveIntegerCursor,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../pagination";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

const categorySelect = {
  id: true,
  name: true,
  color: true,
  icon: true,
  fixedKind: true,
};

export class OperationFixeRepo implements IOperationFixeRepository {
  private entities: any;
  private operationFixeExist: boolean;

  constructor(
    entities: any,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {
    this.entities = entities;
  }

  public async create(
    operationProps: OperationFixeProps,
    userId: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);

    await this.validateCategory(
      operationProps.categoryId,
      idUser,
      typeOperationFixe
    );
    try {
      assertEnvelopeFlag(
        operationProps.isBudgetEnvelope ?? false,
        typeOperationFixe,
        operationProps.periodicite ?? "MENSUELLE"
      );
    } catch (error) {
      throw reconciliationHttpError(error);
    }
    if (operationProps.effectiveMonth !== undefined)
      throw new ErrorException(
        ErrorCode.ValidationFailed,
        "Schedule an existing fixed operation",
        { code: "SCHEDULE_EXISTING_OPERATION" }
      );
    const response = await OperationFixeEntity.create({
      include: { category: { select: categorySelect } },
      data: {
        ...(operationProps.categoryId === undefined
          ? {}
          : { categoryId: operationProps.categoryId }),
        titre: operationProps.titre,
        montant: operationProps.montant,
        devise: operationProps.devise,
        typeOperation: typeOperationFixe,
        userId: idUser,
        ...(typeOperationFixe === "CHARGE"
          ? {
              isBudgetEnvelope: operationProps.isBudgetEnvelope ?? false,
              periodicite: operationProps.periodicite ?? "MENSUELLE",
              pourcentagePersonnel: operationProps.pourcentagePersonnel ?? 100,
            }
          : {}),
      },
    });
    return this.publicRow(response);
  }

  public async read(
    operationProps: ReadOperationFixeProps,
    userId: string,
    idOperation: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperation;

    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
        typeOperation: typeOperationFixe,
      },
      select: {
        idOperationFixe: true,
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
        categoryId: true,
        category: { select: categorySelect },
        isBudgetEnvelope: true,
        versions: {
          where: {
            effectiveMonth: {
              lte: monthDate(parisCivilDateClock().slice(0, 7)),
            },
          },
          orderBy: { effectiveMonth: "desc" },
          take: 1,
        },
        periodicite: true,
        pourcentagePersonnel: true,
      },
      take: 1,
    });
    return resultOperationFixeById.map((row: any) =>
      this.publicRow(resolvedFixedRow(row))
    );

    // }

    //  throw new ErrorException(ErrorCode.PrismaError,`${typeFct} OperationFixe doesn't exist`)
  }

  public async update(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    await this.validateCategory(
      operationProps.categoryId,
      idUser,
      typeOperationFixe
    );
    const existing = (
      await OperationFixeEntity.findMany({
        where: {
          idOperationFixe: operationProps.id,
          userId: idUser,
          typeOperation: typeOperationFixe,
        },
        take: 1,
      })
    )[0];
    if (!existing) return { count: 0 };
    if (
      existing.isBudgetEnvelope ||
      operationProps.isBudgetEnvelope ||
      operationProps.effectiveMonth !== undefined ||
      (await this.entities.fixedOperationVersion.count({
        where: { operationId: operationProps.id, userId: idUser },
      })) > 0
    ) {
      return scheduleFixedVersion(
        this.entities,
        idUser,
        operationProps.id,
        typeOperationFixe,
        {
          titre: operationProps.titre,
          montant: String(operationProps.montant),
          devise: operationProps.devise,
          ...(operationProps.categoryId === undefined
            ? {}
            : { categoryId: operationProps.categoryId }),
          ...(operationProps.periodicite === undefined
            ? {}
            : { periodicite: operationProps.periodicite }),
          ...(operationProps.pourcentagePersonnel === undefined
            ? {}
            : {
                pourcentagePersonnel: String(
                  operationProps.pourcentagePersonnel
                ),
              }),
          ...(operationProps.isBudgetEnvelope === undefined
            ? {}
            : { isBudgetEnvelope: operationProps.isBudgetEnvelope }),
          effectiveMonth: operationProps.effectiveMonth,
        }
      ).catch((error) => {
        throw reconciliationHttpError(error);
      });
    }
    try {
      assertEnvelopeFlag(
        operationProps.isBudgetEnvelope ?? existing.isBudgetEnvelope ?? false,
        typeOperationFixe,
        operationProps.periodicite ?? existing.periodicite ?? "MENSUELLE"
      );
    } catch (error) {
      throw reconciliationHttpError(error);
    }
    const response = await OperationFixeEntity.updateMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
        typeOperation: typeOperationFixe,
      },
      data: {
        ...(operationProps.categoryId === undefined
          ? {}
          : { categoryId: operationProps.categoryId }),
        titre: operationProps.titre,
        montant: operationProps.montant,
        devise: operationProps.devise,
        ...(typeOperationFixe === "CHARGE"
          ? {
              ...(operationProps.isBudgetEnvelope === undefined
                ? {}
                : { isBudgetEnvelope: operationProps.isBudgetEnvelope }),
              ...(operationProps.periodicite === undefined
                ? {}
                : { periodicite: operationProps.periodicite }),
              ...(operationProps.pourcentagePersonnel === undefined
                ? {}
                : {
                    pourcentagePersonnel: operationProps.pourcentagePersonnel,
                  }),
            }
          : {}),
      },
    });
    return response;
  }

  public async delete(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    const rows = await OperationFixeEntity.findMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
        typeOperation: typeOperationFixe,
      },
      include: {
        versions: {
          where: {
            effectiveMonth: {
              lte: monthDate(parisCivilDateClock().slice(0, 7)),
            },
          },
          orderBy: { effectiveMonth: "desc" },
          take: 1,
        },
      },
      take: 1,
    });
    if (
      rows[0] &&
      resolvedFixedRow(rows[0]).isBudgetEnvelope &&
      (await this.entities.reconciliationOccurrence.count({
        where: {
          userId: idUser,
          fixedSourceId: operationProps.id,
          month: { gte: monthDate(parisCivilDateClock().slice(0, 7)) },
          links: { some: {} },
        },
      })) > 0
    ) {
      throw new ErrorException(
        ErrorCode.Conflict,
        "Envelope has current or future linked payments",
        { code: "ENVELOPE_IN_USE" }
      );
    }
    const response = await OperationFixeEntity.deleteMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
        typeOperation: typeOperationFixe,
      },
    });
    return response;
  }

  public getAllOperationsFixes(
    userId: string,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>> {
    return this.listOperations(userId, pagination);
  }

  public getAllCharges(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>> {
    return this.listOperations(userId, pagination, typeOperationFixe);
  }

  public getAllRevenus(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>> {
    return this.listOperations(userId, pagination, typeOperationFixe);
  }

  public async exists(
    idOperationFixe: number,
    idUser: number,
    typeOperation?: string
  ): Promise<boolean> {
    const OperationFixeEntity = this.entities.operationFixe;
    // const id = parseInt(idOperationFixe)
    const resultOperationFixeUser = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        idOperationFixe: idOperationFixe,
        ...(typeOperation === undefined ? {} : { typeOperation }),
      },
      take: 1,
    });

    // const result = resultOperationFixeUser
    if (
      resultOperationFixeUser.length === 0 ||
      resultOperationFixeUser == null
    ) {
      this.operationFixeExist = false;
    } else {
      this.operationFixeExist = true;
    }
    return this.operationFixeExist;
  }

  public async updateRaV(userId: string, idRaV: number) {
    const RaVEntity = this.entities.resteAVivre;
    const ravCalculation = await this.calculateRav(userId);

    const response = await RaVEntity.updateMany({
      where: {
        idRaV: idRaV,
        userId: parseInt(userId),
      },
      data: {
        montantRaV: ravCalculation.montantRaV,
        montantTotalDepense: ravCalculation.montantTotalDepense,
        montantTotalEntree: ravCalculation.montantTotalEntree,
      },
    });

    return response;
  }

  public async createRaV(userId: string) {
    const RaVEntity = this.entities.resteAVivre;
    const ravCalculation = await this.calculateRav(userId);

    const response = await RaVEntity.create({
      data: {
        montantRaV: ravCalculation.montantRaV,
        montantTotalDepense: ravCalculation.montantTotalDepense,
        montantTotalEntree: ravCalculation.montantTotalEntree,
        userId: parseInt(userId),
      },
    });

    return response;
  }
  // public async getRaV(userId:string){

  //   console.log("INSIDE updateOrCreate")
  //   const RaVEntity = this.entities.resteAVivre

  //   const responseGet = await RaVEntity.findMany({
  //     take: 1,
  //     where: {
  //       userId: parseInt(userId),
  //     },
  //     orderBy: {
  //       updated_at: 'desc',
  //     },
  //   })
  // }

  public async updateOrCreateRaV(userId: string) {
    const RaVEntity = this.entities.resteAVivre;

    const responseGet = await RaVEntity.findMany({
      take: 1,
      where: {
        userId: parseInt(userId),
      },
      orderBy: {
        updated_at: "desc",
      },
    });

    let now = new Date();
    let isRaVpastMonth = true;

    if (responseGet.length == 0) {
      return [isRaVpastMonth] as const;
    }

    let monthLastRav = responseGet[0].updated_at.getMonth();
    let currentMonth = now.getMonth();
    let yearLastRav = responseGet[0].updated_at.getFullYear();
    let currentYear = now.getFullYear();
    if (currentYear == yearLastRav) {
      if (currentMonth == monthLastRav) {
        isRaVpastMonth = false;
      } else {
        isRaVpastMonth = true;
      }
    } else {
      isRaVpastMonth = true;
    }

    const idRav = responseGet[0].idRaV;
    return [isRaVpastMonth, idRav] as const;
  }

  private async listOperations(
    userId: string,
    pagination: PaginationRequest,
    typeOperation?: TypeOperationFixeEnum
  ): Promise<CursorPage<OperationFixeListItem>> {
    const idUser = parseInt(userId);
    const context = this.cursorContext(idUser, typeOperation);
    const afterId = decodePositiveIntegerCursor(
      pagination,
      context,
      this.cursors
    );
    const rows = await this.entities.operationFixe.findMany({
      where: {
        userId: idUser,
        ...(typeOperation === undefined ? {} : { typeOperation }),
        ...(afterId === null ? {} : { idOperationFixe: { lt: afterId } }),
      },
      select: {
        idOperationFixe: true,
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
        categoryId: true,
        category: { select: categorySelect },
        isBudgetEnvelope: true,
        versions: {
          where: {
            effectiveMonth: {
              lte: monthDate(parisCivilDateClock().slice(0, 7)),
            },
          },
          orderBy: { effectiveMonth: "desc" },
          take: 1,
        },
        periodicite: true,
        pourcentagePersonnel: true,
      },
      orderBy: { idOperationFixe: "desc" },
      take: pagination.limit + 1,
    });
    return createCursorPage(
      rows.map((row: any) => this.publicRow(resolvedFixedRow(row), true)),
      pagination,
      context,
      (row: OperationFixeListItem) => [row.idOperationFixe],
      this.cursors
    );
  }

  private cursorContext(
    userId: number,
    typeOperation?: TypeOperationFixeEnum
  ): CursorContext {
    return {
      resource: `fixed-operations:${typeOperation ?? "all"}`,
      scope: `owner:${userId}`,
    };
  }

  private async calculateRav(userId: string) {
    const totals = await loadFixedTotals(
      this.entities,
      parseInt(userId),
      undefined,
      parisCivilDateClock().slice(0, 7)
    );
    return {
      montantRaV: (totals.incomeMinorUnits - totals.expenseMinorUnits) / 100,
      montantTotalEntree: totals.incomeMinorUnits / 100,
      montantTotalDepense: totals.expenseMinorUnits / 100,
    };
  }

  private async validateCategory(
    categoryId: number | null | undefined,
    userId: number,
    kind: string
  ) {
    if (categoryId == null) return;
    const category = await this.entities.operationCategory.findFirst({
      where: { id: categoryId, userId },
      select: { id: true, fixedKind: true },
    });
    if (
      !category ||
      (category.fixedKind != null && category.fixedKind !== kind)
    ) {
      throw new ErrorException(
        ErrorCode.ValidationFailed,
        "Category unavailable for this fixed operation",
        { code: "INVALID_FIXED_CATEGORY" }
      );
    }
  }

  private publicRow(row: any, includeType = false) {
    const { idOperationFixe, titre, montant, devise } = row;
    return {
      idOperationFixe,
      titre,
      montant,
      devise,
      categoryId: row.categoryId ?? null,
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            color: row.category.color,
            icon: row.category.icon,
            fixedKind: row.category.fixedKind ?? null,
          }
        : null,
      ...(includeType ? { typeOperation: row.typeOperation } : {}),
      ...(row.typeOperation === "CHARGE"
        ? {
            ...chargeAmountFields(row),
            isBudgetEnvelope: row.isBudgetEnvelope ?? false,
          }
        : {}),
    };
  }
}
