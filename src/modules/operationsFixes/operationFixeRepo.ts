import { TypeOperationFixeEnum } from '@prisma/client';
import { OperationFixeProps } from "./../../utils/validators/operationFixe.validator";
import {
  IOperationFixeRepository,
  OperationFixeListItem,
  OperationFixeWithIdProps,
  ReadOperationFixeProps,
} from "./operationFixeRepository.interface";
import { ResteAVivreCalculator } from "./services/ResteAVivreCalculator";
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

    const response = await OperationFixeEntity.create({
      data: {
        titre: operationProps.titre,
        montant: operationProps.montant,
        devise: operationProps.devise,
        typeOperation: typeOperationFixe,
        userId: idUser,
      },
    })
    const {idOperationFixe,titre,montant,devise} = response

    return {idOperationFixe,titre,montant,devise};
  }

  public async read(
    operationProps: ReadOperationFixeProps,
    userId: string,
    idOperation: string,
    _typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperation;

    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
      },
      select: {
        idOperationFixe:true,
        titre: true,
        montant: true,
        devise: true,
      },
      take: 1,
    });
    return resultOperationFixeById;

    // }

    //  throw new ErrorException(ErrorCode.PrismaError,`${typeFct} OperationFixe doesn't exist`)
  }

  public async update(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    _typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    const response = await OperationFixeEntity.updateMany({
        where: {
          idOperationFixe: operationProps.id,
          userId: idUser,
        },
        data: {
          titre: operationProps.titre,
          montant: operationProps.montant,
          devise: operationProps.devise,
        },
      });
    return response;
  }



  public async delete(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    _typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    const response = await OperationFixeEntity.deleteMany({
        where: {
          idOperationFixe: operationProps.id,
          userId: idUser,
        }
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
    idUser: number
  ): Promise<boolean> {
    const OperationFixeEntity = this.entities.operationFixe;
    // const id = parseInt(idOperationFixe)
    const resultOperationFixeUser = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        idOperationFixe: idOperationFixe,
      },
      take: 1,
    });

    // const result = resultOperationFixeUser
    if (resultOperationFixeUser.length === 0  || resultOperationFixeUser == null) {
      this.operationFixeExist = false;
    } else {
      this.operationFixeExist = true;
    }
    return this.operationFixeExist;
  }

  public async updateRaV(userId:string, idRaV:number){

    const RaVEntity = this.entities.resteAVivre
    const ravCalculation = await this.calculateRav(userId);

    const response = await RaVEntity.updateMany({
        where: {
          idRaV: idRaV,
          userId: parseInt(userId),
        },
        data: {
          montantRaV: ravCalculation.montantRaV,
          montantTotalDepense:ravCalculation.montantTotalDepense,
          montantTotalEntree: ravCalculation.montantTotalEntree,
        },
      })
    
    return response

  }


  public async createRaV(userId:string){

    const RaVEntity = this.entities.resteAVivre
    const ravCalculation = await this.calculateRav(userId);

    const response = await RaVEntity.create({
        data: {
          montantRaV: ravCalculation.montantRaV,
          montantTotalDepense:ravCalculation.montantTotalDepense,
          montantTotalEntree: ravCalculation.montantTotalEntree,
          userId:parseInt(userId)
        },
      })
    
    return response

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



  public async updateOrCreateRaV(userId:string){

    const RaVEntity = this.entities.resteAVivre

    const responseGet = await RaVEntity.findMany({
      take: 1,
      where: {
        userId: parseInt(userId),
      },
      orderBy: {
        updated_at: 'desc',
      },
    })

    let now = new Date();
    let isRaVpastMonth = true 

    if(responseGet.length==0){
      return [isRaVpastMonth, ] as const;
    }

    let monthLastRav = responseGet[0].updated_at.getMonth()
    let currentMonth = now.getMonth()
    let yearLastRav = responseGet[0].updated_at.getFullYear()
    let currentYear = now.getFullYear()
    if(currentYear == yearLastRav ){
      if(currentMonth == monthLastRav){
        isRaVpastMonth = false
      } else{
        isRaVpastMonth = true
      }
    } else{
      isRaVpastMonth = true
    }

    const idRav = responseGet[0].idRaV
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
      },
      orderBy: { idOperationFixe: "desc" },
      take: pagination.limit + 1,
    });
    return createCursorPage(
      rows,
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
    const totals = await this.entities.operationFixe.groupBy({
      by: ["typeOperation"],
      where: { userId: parseInt(userId) },
      _sum: { montant: true },
    });
    const amount = (type: TypeOperationFixeEnum): unknown =>
      totals.find(
        (entry: { typeOperation: TypeOperationFixeEnum }) =>
          entry.typeOperation === type
      )?._sum.montant ?? 0;
    return ResteAVivreCalculator.calculate(
      [{ montant: amount("REVENU") }],
      [{ montant: amount("CHARGE") }]
    );
  }
}
