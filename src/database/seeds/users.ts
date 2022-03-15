import { Prisma } from "@prisma/client"
// import argon2 from "argon2"

// let password!:string;
// async function hashPasswd(){
//     const hashPassword = await argon2.hash("123456");
//     return hashPassword
// }

// hashPasswd().then(res => {
// password = res
// })
// console.log("dans user seed",password)
export const users: Prisma.UtilisateurCreateInput[] = [
    {firstname:"Thibault",
    lastname:'Dupont',
    email:'andria.capai@gmail.com',
    password: "123456",
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
    },
    operations:{
        create:[
           {
            titre:"Restaurant entre amis",
            montant:25,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,10),
            idCategorie:2,
            // userId: 1,
            
        },
        {
            titre:"Cinema",
            montant:10,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,9),
            idCategorie:1,
            // userId: 1,
        },
        {
            titre:"Courses",
            montant:90,
            type:'DEPENSE',
            devise:'EUR',
            dateOperation: new Date(2022,0,9),
            idCategorie:2,
            // userId: 1,
        }
        ]
    }
    }
]