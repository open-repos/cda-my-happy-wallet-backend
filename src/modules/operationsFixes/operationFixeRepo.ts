import { TypeOperationFixeEnum } from '@prisma/client';
import { Result, ResultCode } from "./../../utils/results/";
import { OperationFixeProps } from "./../../utils/validators/operationFixe.validator";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

interface updateOperationFixeProps extends OperationFixeProps {
  id: number;
}
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
    userId: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
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

    const result = await new Result(
      ResultCode.Created,
      `${typeOperationFixe}`
    ).response_post();
    return result;
  }

  public async read(
    operationProps: readOperationFixeProps,
    userId: string,
    idOperation: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperation;

    // console.log(
    //   await OperationFixeEntity.findMany({
    //     where: {
    //       idOperationFixe: operationProps.id,
    //       userId: idUser,
    //     },
    //     select: {
    //       titre: true,
    //       montant: true,
    //       devise: true,
    //     },
    //   })
    // );
    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        idOperationFixe: operationProps.id,
        userId: idUser,
      },
      select: {
        titre: true,
        montant: true,
        devise: true,
      },
    });
    const result = await new Result(
      ResultCode.Read,
      `${typeOperationFixe}`
    ).response_get();
    result.data = resultOperationFixeById;
    return result;

    // }

    //  throw new ErrorException(ErrorCode.PrismaError,`${typeFct} OperationFixe doesn't exist`)
  }

  public async update(
    operationProps: updateOperationFixeProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    console.log(
      await OperationFixeEntity.updateMany({
        where: {
          idOperationFixe: operationProps.id,
          userId: idUser,
        },
        data: {
          titre: operationProps.titre,
          montant: operationProps.montant,
          devise: operationProps.devise,
        },
      })
    );
    return await new Result(
      ResultCode.Updated,
      `${typeOperationFixe}`
    ).response_update();
  }



  public async delete(
    operationProps: updateOperationFixeProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    operationProps.id = +idOperationFixe;
    console.log(
      await OperationFixeEntity.deleteMany({
        where: {
          idOperationFixe: operationProps.id,
          userId: idUser,
        }
      })
    );
    return await new Result(
      ResultCode.Deleted,
      `${typeOperationFixe}`
    ).response_update();
  }


  public async getAllOperationsFixes(userId: string) {
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId);
    const resultOperationFixeById = await OperationFixeEntity.findMany({
      where: {
        userId: idUser,
      },
      select: {
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    const result = await new Result(
      ResultCode.Read,
      "All OperationsFixes"
    ).response_get();
    result.data = resultOperationFixeById;
    return result;

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
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    const result = await new Result(
      ResultCode.Read,
      `All ${typeOperationFixe}`
    ).response_get();
    result.data = resultOperationFixeById;
    return result;

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
        titre: true,
        montant: true,
        devise: true,
        typeOperation: true,
      },
    });
    const result = await new Result(
      ResultCode.Read,
      `All ${typeOperationFixe}`
    ).response_get();
    result.data = resultOperationFixeById;
    return result;

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
}
