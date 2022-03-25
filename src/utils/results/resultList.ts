import { ResultCode } from './resultCode';
// import { NODE_ENV } from "../../config/config";

export class Result{
  public status: number;
  public success: boolean;
  public message?:string;
  public additionalInfo?: any;
  public data?: any;
  public payload?: any;
  public name:string;
//   public object?:any;

  constructor(
    name: string = ResultCode.Read,
    additionalInfo:string="",
    message:string= "",
    data: any = null,
    payload: any = null,
    // object:any=null,
  ) {
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = name;
    this.success = true;
    this.status = 200;
    this.message = message;
    this.payload=payload;
    this.additionalInfo=additionalInfo;
    this.data=data;
    // this.object=object
    switch (name) {
      case ResultCode.Created:
        this.status = 201;
        this.message = `${this.additionalInfo} Successfully Created`;
        break;
    case ResultCode.Post:
        this.message = `${this.additionalInfo} Post Request Successfully executed`;
        break;
    case ResultCode.Read:
        this.message = `${this.additionalInfo} Successfully Read`;
        break;
    case ResultCode.Updated:
        this.message = `${this.additionalInfo} Successfully Updated`;
        break;
    case ResultCode.Updated:
        this.message = `${this.additionalInfo} Successfully Deleted`;
        break;  
    default:
        this.message= 'Request successfully completed'
        break;
    }
    // if (NODE_ENV !== "production") {
    //   Error.captureStackTrace(this);
    // }
    // this.object = this.response()
  }
  public async response_post(){
    // if (!this.data && !this.payload){
        let objRes={
            "success": true,
            "message": this.message,
            "payload":this.payload,
    }
    return objRes
}
public async response_get(){
    // if (!this.data && !this.payload){
        let objRes={
            "success": true,
            "message": this.message,
            "data":this.data
    }
    return objRes
}
public async response_delete(){
    // if (!this.data && !this.payload){
        let objRes={
            "success": true,
            "message": this.message,
    }
    return objRes
}

public async response_update(){
    // if (!this.data && !this.payload){
        let objRes={
            "success": true,
            "message": this.message,
    }
    return objRes
  
}
}
