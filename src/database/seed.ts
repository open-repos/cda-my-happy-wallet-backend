
import { PrismaClient } from "@prisma/client"
import { users } from "./seeds/users"
import { categories } from './seeds/categories';
// import { operations } from "./seeds/operations";
const prisma = new PrismaClient();
async function main(){
    console.log('Seeding categories...')
    // for (let cat of categories){
        // print(user)
        await prisma.categorie.createMany({
             data: categories
            })
    // }

    console.log('Seeding users...')
    for (let user of users){
        // print(user)
        await prisma.utilisateur.create({
             data: user
            ,
            // include:{
            //     operationsFixes:true,
            //     operations:true,
            // }
            })
    }
    // console.log('Seeding operations...')
    // // for (let op of operations){
    //     // print(user)
    //     await prisma.operation.createMany({
    //          data: operations
    //         })
    // }
    
}
main().catch((e) => {
    console.error(e)
    process.exit(1)
}).finally(async () => {
    await prisma.$disconnect()
})