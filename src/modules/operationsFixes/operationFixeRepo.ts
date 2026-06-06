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
    console.log("typeOperation selon l'appel d'API", typeOperationFixe);
    console.log("Contenu Props envoyé selon l'appel d'API", operationProps);

    const response = await OperationFixeEntity.create({
      data: {
        titre: operationProps.titre,
        montant: operationProps.montant,
        devise: operationProps.devise,
        typeOperation: typeOperationFixe,
        userId: idUser,
      },
    })
    console.log("reponse create opfixe",response)
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
    console.log(response);
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
    console.log(response);
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
    console.log("EXIST - OperationFixeID:", idOperationFixe);
    console.log("EXIST - userId:", idUser);
    console.log("EXIST - typeof(userId):", typeof idUser);
    const resultOperationFixeUser = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        idOperationFixe: idOperationFixe,
      },
    });
    console.log(resultOperationFixeUser);

    // const result = resultOperationFixeUser
    if (resultOperationFixeUser.length === 0  || resultOperationFixeUser == null) {
      this.operationFixeExist = false;
    } else {
      this.operationFixeExist = true;
    }
    return this.operationFixeExist;
  }

  public async updateRaV(userId:string, idRaV:number){

    console.log("INSIDE updateRav")
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
      console.log("reponse updated rav",response)
    
    return response

  }


  public async createRaV(userId:string){

    console.log("INSIDE updateRav")
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
      console.log("reponse create rav",response)
    
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

    console.log("INSIDE updateOrCreate")
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

    console.log("Rav Findmany",responseGet)
    console.log("Rav Findmany last",responseGet[0].updated_at)
    console.log("Rav Findmany Month",responseGet[0].updated_at.getMonth())
    console.log("now Month",now.getMonth())
    console.log("Rav Findmany year",responseGet[0].updated_at.getFullYear())
    console.log("now year",now.getFullYear())
    console.log("typeof year and month",`${typeof(now.getFullYear())} and ${typeof(now.getMonth())} ` )

    let monthLastRav = responseGet[0].updated_at.getMonth()
    let currentMonth = now.getMonth()
    let yearLastRav = responseGet[0].updated_at.getFullYear()
    let currentYear = now.getFullYear()
    if(currentYear == yearLastRav ){
      console.log("currentYear == yearLastRav")
      if(currentMonth == monthLastRav){
        console.log("currentYear == yearLastRav && currentMonth == monthLastRav")
        isRaVpastMonth = false
      } else{
        console.log("currentYear == yearLastRav && currentMonth != monthLastRav")
        isRaVpastMonth = true
      }
    } else{
      console.log("currentYear != yearLastRav")
      isRaVpastMonth = true
    }

    const idRav = responseGet[0].idRaV
     return [isRaVpastMonth, idRav] as const;
  }
}
