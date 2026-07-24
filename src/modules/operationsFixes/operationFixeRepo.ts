import { TypeOperationFixeEnum } from '@prisma/client';
import { OperationFixeProps } from "./../../utils/validators/operationFixe.validator";
import {
  IOperationFixeRepository,
  OperationFixeWithIdProps,
  ReadOperationFixeProps,
} from "./operationFixeRepository.interface";
import { ResteAVivreCalculator } from "./services/ResteAVivreCalculator";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

export class OperationFixeRepo implements IOperationFixeRepository {
  private entities: any;
  private operationFixeExist: boolean;

  constructor(entities: any) {
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


  public async getAllOperationsFixes(userId: string) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
      },
      select: {
        idOperationFixe:true,
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    return resultOperationFixeById;

  }


  public async getAllCharges(userId: string, typeOperationFixe:TypeOperationFixeEnum) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        typeOperation:typeOperationFixe
      },
      select: {
        idOperationFixe:true,
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    return resultOperationFixeById;

  }

  public async getAllRevenus(userId: string, typeOperationFixe:TypeOperationFixeEnum) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        typeOperation:typeOperationFixe
      },
      select: {
        idOperationFixe:true,
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    return resultOperationFixeById;

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
    const allRevenus = await this.getAllRevenus(userId,"REVENU")
    const allCharges= await this.getAllCharges(userId,"CHARGE")
    const ravCalculation = ResteAVivreCalculator.calculate(
      allRevenus,
      allCharges
    );

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
    const allRevenus = await this.getAllRevenus(userId,"REVENU")
    const allCharges= await this.getAllCharges(userId,"CHARGE")
    const ravCalculation = ResteAVivreCalculator.calculate(
      allRevenus,
      allCharges
    );

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
}
