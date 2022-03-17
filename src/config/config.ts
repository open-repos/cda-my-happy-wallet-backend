// Libraire path natif en nodejs
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../../');
dotenv.config({ path: envPath + '.env'});

export const PORT=process.env.PORT 
export const NODE_ENV=process.env.NODE_ENV
export const APP_BASE_URL=process.env.APP_BASE_URL  //|| "/v1/"
export const ACCESS_TOKEN_SECRET=process.env.ACCESS_TOKEN_SECRET
export const REFRESH_TOKEN_SECRET=process.env.REFRESH_TOKEN_SECRET
export const JWT_PASSPHRASE = process.env.JWT_PASSPHRASE || 'default passphrase'
// export const DATABASE_URL=process.env.DATABASE_URL

