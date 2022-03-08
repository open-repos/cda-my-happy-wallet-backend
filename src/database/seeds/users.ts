import { Prisma } from "@prisma/client"

export const users: Prisma.UtilisateurCreateInput[] = [
    {firstname:"Thibault",
    lastname:'Dupont',
    email:'andria.capai@gmail.com',
    password:'123456',
    operationsFixes:{
        create:[{
            titre:"Loyer",
            montant:300,
            typeOperation:'CHARGE',
            devise:'EUR',
        },
        {
            titre:"Bourse Crous",
            montant:200,
            typeOperation:'REVENU',
            devise:'EUR',
        },
        {
            titre:"Aide Parents",
            montant:350,
            typeOperation:'REVENU',
            devise:'EUR',
        },
    ]  
    }
    }
]