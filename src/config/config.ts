// Libraire path natif en nodejs
import dotenv from 'dotenv';
// import path from 'path';
// https://kinsta.com/fr/blog/codes-statut-http/

// const envPath = path.join(__dirname, '../../');
// dotenv.config({ path: envPath + '.env'});
dotenv.config();
export const PORT=process.env.PORT 
export const NODE_ENV=process.env.NODE_ENV
export const APP_BASE_URL=process.env.APP_BASE_URL || "/v1"
export const ACCESS_TOKEN_SECRET=process.env.ACCESS_TOKEN // || 'default passphrase_atoken knzkné&àé)ek"k"jj"ndx'
export const REFRESH_TOKEN_SECRET=process.env.REFRESH_TOKEN  //|| 'default passphrase_rtoken enenkn"jéjéjjééé'
export const DATABASE_URL=process.env.DATABASE_URL
export const SENDGRID_API_KEY=process.env.SENDGRID_API_KEY
export const REGISTER_TOKEN=process.env.REGISTER_TOKEN
export const EMAIL_SENDER=process.env.EMAIL_SENDER
export const MAILER_DRIVER=process.env.MAILER_DRIVER || (NODE_ENV === "production" ? "sendgrid" : "smtp")
export const SMTP_HOST=process.env.SMTP_HOST || "mailpit"
export const SMTP_PORT=Number(process.env.SMTP_PORT || 1025)
export const SMTP_SECURE=process.env.SMTP_SECURE === "true"
export const CORS_ORIGINS=(process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean)
export const API_PUBLIC_URL=process.env.API_PUBLIC_URL || (NODE_ENV === "production" ? "https://api.myhappywallet.andriacapai.com" : "http://localhost:4200")
export const FRONTEND_URL=process.env.FRONTEND_URL || (NODE_ENV === "production" ? "https://myhappywallet.andriacapai.com" : "http://localhost:5173")
