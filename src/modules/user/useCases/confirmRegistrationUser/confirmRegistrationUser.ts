import { IUserRepository } from '../../userRepository.interface';
import { ErrorException,ErrorCode } from '../../../../utils/errors'
import {
    REGISTER_TOKEN,
  } from "./../../../../config/config";
import { ITokenService } from '../../../auth/token/TokenService.interface';
import { JsonWebTokenService } from '../../../auth/token/JsonWebTokenService';
export class ConfirmRegistrationUser {
    private userRepo: IUserRepository;
    private tokenService: ITokenService;
    constructor(
      userRepo: IUserRepository,
      tokenService: ITokenService = new JsonWebTokenService()
    ) {
        this.userRepo = userRepo
        this.tokenService = tokenService
    }

    public async execute(id: string, token:string) {

          
            const user = await this.userRepo.getUserById(parseInt(id));
            console.log("exists user?", user);
            console.log('JUSTE AVANT LE MODIF DE SATUS ET VERIF DE TOKEN')
            
            
            if (!user) {
              throw new ErrorException(ErrorCode.UnknownError);
            }
        
            const token_check = await this.tokenService.verify(
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
