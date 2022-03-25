import { UserRepo } from '../../userRepo';
import { ErrorException } from '../../../../utils/errors/errorException.error';
import { ErrorCode } from './../../../../utils/errors/errorCode.error';
import { verify } from "jsonwebtoken";
import {
    REGISTER_TOKEN,
  } from "./../../../../config/config";
export class ConfirmRegistrationUser {
    private userRepo: UserRepo;

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    public async execute(id: string, token:string) {

          
            const user = await this.userRepo.getUserById(parseInt(id));
            console.log("exists user?", user);
            console.log('JUSTE AVANT LE MODIF DE SATUS ET VERIF DE TOKEN')

            if (!user) {
              throw new ErrorException(ErrorCode.SendEmaillError);
            }
        
            const token_check = await verify(
              token,
              REGISTER_TOKEN as string,
              function (err: any, _: any) {
                if (err) {
                  console.log("WRONG REGISTER TOKEN");
                  throw new ErrorException(
                    ErrorCode.Unauthorized,
                    "The register token is not valid."
                  );
                  // return refreshTokenAuth(req,res,next)
                }
              }
            );
            console.log("register_token_check", token_check);
            const result = await this.userRepo.confirmRegistration(id);
            // const {register_token, ...userInfo}=newUserInfo
            return result
    }
}