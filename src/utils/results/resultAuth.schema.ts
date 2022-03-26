import Joi from "joi";
import j2s from "joi-to-swagger";

enum roleUser {
"USER"=1,
"ADMIN"
}


type userProps = {
firstname:string;
lastname:string;
email:string;
role:roleUser;
verified:boolean;
}

type payloadProps = {
  user: string;
  accessToken: string;
  expires:string
};
type resultAuthProps = {
  success: string;
  payload: payloadProps;
};

const nestedUserSchema = Joi.object<userProps>({
    firstname: Joi.string().example("capitaine"),
    lastname: Joi.string().example("haddock"),
    email: Joi.string().email().lowercase().trim(true).example("capitaine@hadock.fr"),
    role: Joi.string().valid("USER","ADMIN").example("USER"),
    verified: Joi.boolean().example(true)
  });

const nestedPayloadrSchema = Joi.object<payloadProps>({
  user: nestedUserSchema,
  accessToken: Joi.string().example("accesstokenXXXXXXXXXXXXXXXXXXXXXXXX"),
  expires: Joi.string().example("60s"),
});

const resultAuthSchema = Joi.object<resultAuthProps>({
  success: Joi.boolean().example(true),
  payload: nestedPayloadrSchema,
});

export const resultAuthSchemaSwg = j2s(resultAuthSchema).swagger;
// console.log(errorSchemaSwg, j2s(resultAuthSchema).components);