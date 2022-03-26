
import { Result, ResultCode } from './../../utils/results/';
import { OperationFixeProps } from './../../utils/validators/operationFixe.validator';
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

interface updateOperationFixeProps extends OperationFixeProps {
  id: number;
};
type readOperationFixeProps = {
  id: number;
};

export class OperationFixeRepo {
  private entities: any;
  private operationFixeExist: boolean;

  constructor(entities: any) {
    this.entities = entities;
  }

  public async create(
    operationProps: OperationFixeProps,
    userId:string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId)
    console.log("typeOperation selon l'appel d'API", typeOperationFixe);
    console.log("Contenu Props envoyé selon l'appel d'API", operationProps);
    console.log(
      await OperationFixeEntity.create({
        data: {
          titre: operationProps.titre,
          montant: operationProps.montant,
          devise: operationProps.devise,
          typeOperation: typeOperationFixe,
          userId: idUser,
        },
      })
    );
    
    const result = await new Result(ResultCode.Created,`${typeOperationFixe}`).response_post()
    return result ;
  }

  public async read(
    operationProps: readOperationFixeProps,
    userId:string,
    idOperation: string,
    typeOperationFixe: string,
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId)
    operationProps.id = +idOperation;

      console.log(
        await OperationFixeEntity.findMany({
          where: {
              idOperationFixe: operationProps.id,
              userId:idUser
            },
          select: {
            titre: true,
            montant: true,
            devise: true,
          },
        })
      );
      const resultOperationFixeById = await OperationFixeEntity.findMany({
        where: {
            idOperationFixe: operationProps.id,
            userId:idUser
          },
        select: {
          titre: true,
          montant: true,
          devise: true,
        },
      })
      const result = await new Result(ResultCode.Read,`${typeOperationFixe}`).response_get()
      result.data = resultOperationFixeById
      return result

    // }

    //  throw new ErrorException(ErrorCode.PrismaError,`${typeFct} OperationFixe doesn't exist`)
  }


  public async update(
    operationProps: updateOperationFixeProps,
    idOperationFixe: string,
    typeOperationFixe: string,
  ) {
    const OperationFixeEntity = this.entities.operationFixe;

    operationProps.id = +idOperationFixe;
    console.log(
        await OperationFixeEntity.update({
          where: {
              idOperationFixe: operationProps.id,
            },
          data: {
            titre: operationProps.titre,
            montant: operationProps.montant,
            devise: operationProps.devise,
          },
        })
      );
      return await new Result(ResultCode.Updated,`${typeOperationFixe}`).response_update()
  }

  public async exists(
    idOperationFixe: number,
    idUser: number
  ): Promise<boolean> {
    const OperationFixeEntity = this.entities.operationFixe;
    // const id = parseInt(idOperationFixe)
    console.log("EXIST - OperationFixeID:", idOperationFixe);
    console.log("EXIST - userId:", idUser);
    console.log("EXIST - typeof(userId):", typeof(idUser));
    const resultOperationFixeUser = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
        idOperationFixe: idOperationFixe,
      },
    });
    console.log(resultOperationFixeUser);

    // const result = resultOperationFixeUser
    if (resultOperationFixeUser == [] || resultOperationFixeUser == null) {
      this.operationFixeExist = false;
    } else {
      this.operationFixeExist = true;
    }
    return this.operationFixeExist;
  }
}
