import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'

//Nous avons besoin ici de remettre cette config avec dotenv 
//Pour que Prisma puisse aller chercher où se trouve le fichier .env qui contiendra les informations de notre BDD
const envPath = path.join(__dirname, '../../');
dotenv.config({ path: envPath + '.env' })

const prisma = new PrismaClient({ log: ['query'] })

export { prisma }