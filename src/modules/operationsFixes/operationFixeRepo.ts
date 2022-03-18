// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

type createOperationFixeProps = {
  titre: string;
  montant: number;
  devise: string;
};

type updateOperationFixeProps = {
  id: number;
  titre: string;
  montant: number;
  devise: string;
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
    operationProps: createOperationFixeProps,
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
    // await this.createInsideDataBase(OperationFixeEntity,operationProps,typeOperationFixe)

    return;
  }

  public async read(
    operationProps: readOperationFixeProps,
    userId:string,
    idOperation: string,
    typeOperationFixe: string,
  ) {
    const typeFct:string="READ"
    const OperationFixeEntity = this.entities.operationFixe;
    const idUser = parseInt(userId)
    operationProps.id = +idOperation;
    console.log(`${typeFct} - ID operationFixe :`, operationProps.id);
    console.log(`${typeFct}- typeOperation selon l'appel d'API`, typeOperationFixe);
    console.log(
      `${typeFct}- Contenu Props envoyé selon l'appel d'API`,
      operationProps
    );
    const exists = await this.exists(operationProps.id, idUser);
    console.log("Operation exists ?", exists);

    if (exists) {
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
      return resultOperationFixeById

    }

    return;
  }


  public async update(
    operationProps: updateOperationFixeProps,
    userId:string,
    idOperationFixe: string,
    typeOperationFixe: string,
  ) {
    const typeFct:string="UPDATE"
    const OperationFixeEntity = this.entities.operationFixe;

    operationProps.id = +idOperationFixe;
    const idUser = parseInt(userId)
    console.log(`${typeFct} - ID operationFixe :`, operationProps.id);
    console.log(`${typeFct}- typeOperation selon l'appel d'API`, typeOperationFixe);
    console.log(
      `${typeFct}- Contenu Props envoyé selon l'appel d'API`,
      operationProps
    );

    const exists = await this.exists(operationProps.id, idUser);
    console.log("Operation exists ?", exists);

    if (exists) {
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
    }

    return;
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
