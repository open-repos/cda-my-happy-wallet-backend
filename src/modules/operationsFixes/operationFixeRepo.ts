// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

type createOperationFixeProps = {
  titre: string;
  montant: number;
  devise: string;
  userId: number;
};

type updateOperationFixeProps = {
  id: number;
  titre: string;
  montant: number;
  devise: string;
  userId: number;
};

export class OperationFixeRepo {
  private entities: any;
  private operationFixeExist: boolean;

  constructor(entities: any) {
    this.entities = entities;
  }

  public async create(
    operationProps: createOperationFixeProps,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;

    console.log("typeOperation selon l'appel d'API", typeOperationFixe);
    console.log("Contenu Props envoyé selon l'appel d'API", operationProps);
    console.log(
      await OperationFixeEntity.create({
        data: {
          titre: operationProps.titre,
          montant: operationProps.montant,
          devise: operationProps.devise,
          typeOperation: typeOperationFixe,
          userId: operationProps.userId,
        },
      })
    );
    // await this.createInsideDataBase(OperationFixeEntity,operationProps,typeOperationFixe)

    return;
  }

  public async update(
    operationProps: updateOperationFixeProps,
    idOperation: string,
    typeOperationFixe: string
  ) {
    const OperationFixeEntity = this.entities.operationFixe;

    operationProps.id = +idOperation;
    console.log("UPDATE - ID operationFixe :", operationProps.id);
    console.log("UPDATE- typeOperation selon l'appel d'API", typeOperationFixe);
    console.log(
      "UPDATE- Contenu Props envoyé selon l'appel d'API",
      operationProps
    );
    console.log(
      "UPDATE- Contenu Props envoyé selon l'appel d'API",
      operationProps
    );

    const exists = await this.exists(operationProps.id, operationProps.userId);
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
    // const id = +idOperationFixe
    console.log("EXIST - OperationFixeID:", idOperationFixe);
    console.log("EXIST - userId:", idUser);
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
