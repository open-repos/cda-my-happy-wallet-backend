
import { Prisma } from "@prisma/client";
export const operations : Prisma.OperationCreateInput[]=[
    {
            titre:"Restaurant entre amis",
            montant:25,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,9),
            idCategorie:1,
            userId: 1,
            
        },
        {
            titre:"Cinema",
            montant:10,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,9),
            idCategorie:1,
            userId: 1,
        },
        {
            titre:"Courses",
            montant:90,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,9),
            idCategorie:2,
            userId: 1,
        },
    ]  