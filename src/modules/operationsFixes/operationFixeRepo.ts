// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createOperationFixe.ts

type createOperationFixeProps = {
  titre: string;
  montant: number;
  devise: string;
  userId: number;
};

export class OperationFixeRepo {
  private entities: any;

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
}
//   public async createInsideDataBase(OperationFixeEntity:any,operationProps:createOperationFixeProps, typeOperationFixe:string){
          
//     console.log("Create with Prisma /n Objet envoyé depuis le front:",operationProps,"/n type d'operationFixe:/n",typeOperationFixe)
//     console.log(
//             await OperationFixeEntity.create({
//                 data: {
//                     titre: operationProps.titre,
//                     montant: operationProps.montant,
//                     devise: operationProps.devise,
//                     typeOperation: typeOperationFixe,
//                     userId: operationProps.userId,
//                   },
//              })
//            );
//   }
// }
