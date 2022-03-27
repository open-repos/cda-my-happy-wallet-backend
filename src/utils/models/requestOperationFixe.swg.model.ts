type Method = "Create" | "Update";
type MethodHttp= "post" | "put";
type typeOpFixe =  "Charge" | "Revenu"
export class RequestOperationFixe {
  public type: string;
  public jsonStruct: object;
  public method: Method;
  public methodHttp:MethodHttp;

  constructor(type: typeOpFixe = "Charge", method: Method = "Create", methodHttp:MethodHttp="post") {
    this.type = type;
    this.method = method;
    this.methodHttp = methodHttp;

    this.jsonStruct = {
      tags: ["OperationsFixe"],
      summary: `${this.method} ${this.type}`,
      operationId: `${this.methodHttp}${this.type}`,
      requestBody: {
        description: `Fill all fields in order to ${this.method} ${this.type}`,
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/${this.type}`,
            },
          },
        },
        required: true,
      },
    };
  }
}
