
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
    // for (let user of users){
    //     // print(user)
    //     await prisma.utilisateur.create({
    //          data: user
    //         ,
    //         // include:{
    //         //     operationsFixes:true,
    //         //     operations:true,
    //         // }
    //         })
    // }

    try {
        await Promise.all(users.map(async (user) => {
            prisma.utilisateur.create({
                data: user
               ,
               // include:{
               //     operationsFixes:true,
               //     operations:true,
               // }
               });
        }))} 
        catch(error) {
        console.log(error)
        }

        // try {
        //     await Promise.all(operations.map(async (operation) => {
        //         prisma.operation.create({
        //             data: operation
        //            });
        //     }))} 
        //     catch(error) {
        //     console.log(error)
        //     }
    
}
main().catch((e) => {
    console.error(e)
    process.exit(1)
}).finally(async () => {
    await prisma.$disconnect()
})