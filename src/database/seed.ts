import { PrismaClient } from "@prisma/client"
import { users } from "./seeds/users"

const prisma = new PrismaClient();
async function main(){
    console.log('Seeding users...')
    for (let user of users){
        // print(user)
        await prisma.utilisateur.create({
             data: user
            //   {firstname:"Thibault",
            //  lastname:'Dupont',
            //  email:'andria.capai@gmail.com',
            //  password:'123456',
            //  operationsFixes:{
            //      create:[
            //     {
            //          titre:"Loyer",
            //          montant:'300',
            //          typeOperation:'CHARGE',
            //          devise:'EUR',
            //      },
            //      {
            //          titre:"Bourse Crous",
            //          montant:'200',
            //          typeOperation:'REVENU',
            //          devise:'EUR',
            //      },
            //      {
            //          titre:"Aide Parents",
            //          montant:'350',
            //          typeOperation:'REVENU',
            //          devise:'EUR',
            //      },
            //  ]
                 
            //  }},
            ,    
            include:{
                operationsFixes:true
            }
            })
    }
    
}
main().catch((e) => {
    console.error(e)
    process.exit(1)
}).finally(async () => {
    await prisma.$disconnect()
})