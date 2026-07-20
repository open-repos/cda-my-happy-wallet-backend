import Joi from "joi"
import j2s from "joi-to-swagger"

const regexGlobal = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^\&*\)\(+=._-])(?=.{8,})");
const regexOneLowerCase = new RegExp("^(?=.*[a-z])");
const regexOneUpperCase = new RegExp("^(?=.*[A-Z])");
const regexOneNumber= new RegExp("^(?=.*[0-9])");
const regexOneSpecialCharacter= new RegExp("^(?=.*[!@#\$%\^\&*\)\(+=._-])");
const regexMinLengtheight= new RegExp("^(?=.{8,})");


export const nestedStrongPassword = Joi.string().pattern(regexGlobal)
  .trim(true).required().example("MypassworD!0").error((error:any)=> {
    error.forEach((err:any) => {
      let list_error= []
      switch (err.code) {
        case "any.empty":
          err.message = "Value should not be empty!";
          break;
        case "string.pattern.base":
          if(!regexOneLowerCase.test(err.value)){
            list_error.push("1 Lowercase is required")
          }
          if(!regexOneUpperCase.test(err.value)){
           list_error.push("1 Uppercase is required")
         }
         if(!regexOneNumber.test(err.value)){
           list_error.push("1 Number is required")
         }
         if(!regexOneSpecialCharacter.test(err.value)){
           list_error.push("1 Special character from [!@#\$%\^&\*]  is required")
         }
         if(!regexMinLengtheight.test(err.value)){
           list_error.push("Minimum length password 8 characters")
         }
         err.message = list_error.join(",")
          break;
        default:
          break;
      }
    
    });
    return error;
  })

export type createUserProps = {
    email: string;
    password: string;
    firstname: string;
    lastname: string;
    confirmpassword:string;
  };
export const registerSchema = Joi.object<createUserProps>({
    email: Joi.string().email().lowercase().trim(true).required().example("thibault@example.com"),
    password: nestedStrongPassword,
    firstname: Joi.string().min(1).trim(true).required().example("Thibault"),
    lastname: Joi.string().min(1).trim(true).required().example("Dupont"),
    confirmpassword:Joi.string().trim(true).required().valid(Joi.ref('password')),
});

// ^                               start anchor
// (?=(.*[a-z]){1,})               lowercase letters. {1,} indicates that you want at least 1 of this group
// (?=(.*[A-Z]){1,})               uppercase letters. {1,} indicates that you want at least 1 of this group
// (?=(.*[0-9]){1,})               numbers. {1,} indicates that you want at least1 of this group
// (?=(.*[!@#$%^&*()\-__+.]){1,})  all the special characters in the [] fields. The ones used by regex are escaped by using the \ or the character itself. {1,} is redundant, but good practice, in case you change that to more than 1 in the future. Also keeps all the groups consistent
// {8,}                            indicates that you want 8 or more
// $                               end anchor


export const registerSchemaSwg = j2s(registerSchema).swagger
// console.log(registerSchemaSwg, j2s(registerSchema).components)
