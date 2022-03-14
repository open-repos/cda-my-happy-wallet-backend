
import { PrismaClient } from "@prisma/client"
import { users } from "./seeds/users"
import { categories } from './seeds/categories';
// import { operations } from "./seeds/operations";
const prisma = new PrismaClient();
async function main(){
    // console.log('Seeding categories...')
    // /for (let cat of categories){
    // // print(user)

        const cat = await prisma.categorie.findMany()
        if (cat == []){
            await prisma.categorie.createMany({
                data: categories
               })
        } else {
            console.log("outside",cat)
        }
        
    // // }

    // try {
    //     await Promise.all(categories.map(async (categorie) => {
    //         await prisma.categorie.create({
    //             data: categorie
    //            ,
    //            // include:{
    //            //     operationsFixes:true,
    //            //     operations:true,
    //            // }
    //            });
    //     }))} 
    //     catch(error) {
    //     console.log(error)
    //     }
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
        const usersDb = await prisma.utilisateur.findMany({
        select:{
            email:true,
        }
    })
    console.log("usersDb",usersDb)}
    catch(error) {
        console.log(error)
    }

    const usersDb = await prisma.utilisateur.findMany()
    if (usersDb ==[]){
        console.log("liste utilisateur empty")
    }
    if (usersDb !=[]){
    console.log("usersDb",usersDb)
    console.log("categories",cat)
    try {
        await Promise.all(users.map(async (user) => {
            console.log(user.email)
            // if (usersDb.includes(user) == false){
                await prisma.utilisateur.create({
                    data: user
                   ,
                   });
            // }
            
        }))} 
        catch(error) {
        console.log(error)
        }
    }

        // try {
        //     await Promise.all(operations.map(async (operation) => {
        //         await prisma.operation.create({
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