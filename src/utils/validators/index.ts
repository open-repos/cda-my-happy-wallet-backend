import { operationFixeSchema } from './operationFixe.validator';
import { registerSchema } from './register.validator';
import { loginSchema } from './login.validator';

export const register = registerSchema
export const login= loginSchema
export const operationFixe = operationFixeSchema
// module.exports = {
//     register ,
//     login,
//     operationFixe
// }
// export {register,login,operationFixe}