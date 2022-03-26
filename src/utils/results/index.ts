import { ListOperationFixeSchemaSwg, ListChargeSchemaSwg, ListRevenuSchemaSwg } from './resultOperationFixe.schema';
import { resultAuthSchemaSwg } from './resultAuth.schema';
import { Result } from "./resultList";
import { ResultCode } from "./resultCode";
import Joi from "joi";
import j2s, { SwaggerSchema } from "joi-to-swagger";

type succesProps = {
    success: boolean;
    message: string;
  };
  
  
const successResponseSchema = Joi.object<succesProps>({
    success: Joi.boolean().example(true),
    message: Joi.string().example("Successful request"),
  });
  
const successSchemaSwg = j2s(successResponseSchema).swagger;
// console.log(successSchemaSwg, j2s(successResponseSchema).components);


interface ISchemaSwg{
  success:SwaggerSchema
  resAuth:SwaggerSchema
  arrayOperationFixe:SwaggerSchema
  arrayCharge:SwaggerSchema
  arrayRevenu:SwaggerSchema
}

export const ResSchemaSwg:ISchemaSwg={
  success: successSchemaSwg,
  resAuth:resultAuthSchemaSwg,
  arrayOperationFixe:ListOperationFixeSchemaSwg,
  arrayCharge:ListChargeSchemaSwg,
  arrayRevenu:ListRevenuSchemaSwg
}


export {Result,ResultCode}