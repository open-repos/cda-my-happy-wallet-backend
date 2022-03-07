import dotenv from 'dotenv'
import path from 'path'

//Le fichier .env que nous utiliserons ici se trouve à la racine de notre mono repo
const envPath = path.join(__dirname, '../../');
dotenv.config({ path: envPath + '.env' })

export const PORT = process.env.PORT || '3000'
export const APP_BASE_URL = process.env.APP_BASE_URL || '/api/v1/'
export const JWT_PASSPHRASE = process.env.JWT_PASSPHRASE || 'default passphrase'
