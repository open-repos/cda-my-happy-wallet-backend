
import Ajv, {JSONSchemaType,DefinedError} from "ajv"
const ajv = new Ajv()

export interface UserRegisterModel {
    email:string,
    password:string,
    firstname:string,
    lastname:string,
}

const schema: JSONSchemaType<UserRegisterModel> = {
  type: "object",
  properties: {
    email: {type: "string"},
    password: {type: "string"},
    firstname:{type:"string"},
    lastname:{type:"string"}
  },
  required: ["email","password","firstname","lastname"],
  additionalProperties: false
}

// validate is a type guard for MyData - type is inferred from schema type
export const validate = ajv.compile(schema)

export const isRequestClean = async (props:any):Promise<boolean>=> {
if (validate(props)) {
    // data is MyData here
    console.log(props)
    return true
  } else {
    // The type cast is needed, as Ajv uses a wider type to allow extension
    // You can extend this type to include your error types as needed.
    for (const err of validate.errors as DefinedError[]) {
      switch (err.keyword) {
        case "type":
          // err type is narrowed here to have "type" error params properties
          console.log(err.params.type)
        break
          // ...
      }
    }
    return false
  }
}

// or, if you did not use type annotation for the schema,
// type parameter can be used to make it type guard:
// const validate = ajv.compile<MyData>(schema)


// export const isBodyTypeRegisterUser = async (body: any):Promise<boolean> => {
//     return (body as UserRegisterModel).email !== undefined &&
//       (body as UserRegisterModel).password !== undefined &&
//       (body as UserRegisterModel).firstname !== undefined &&
//       (body as UserRegisterModel).lastname !== undefined ;
//   }