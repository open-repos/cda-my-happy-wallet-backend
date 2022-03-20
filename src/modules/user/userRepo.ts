import { NODE_ENV } from './../../../../../Projet-04-Creation-application-FULLSTACK-09-13-Aout/api/src/config';
import { ErrorCode } from './../../utils/errors/errorCode.error';
import { ErrorException } from './../../utils/errors/errorException.error';
import { SENDGRID_API_KEY,PORT, APP_BASE_URL,REGISTER_TOKEN, EMAIL_SENDER } from "./../../config/config";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createUser.ts
import { createUserProps } from "../../utils/validators/register.validator";
// import nodemailer from "nodemailer";
// const sendgridTransport = require("nodemailer-sendgrid-transport");
import sgMail from "@sendgrid/mail";
import { sign , verify} from 'jsonwebtoken'

export class UserRepo {
  private entities: any;
  private emailExist: boolean;

  constructor(entities: any) {
    this.entities = entities;
  }

  public async create(userProps: createUserProps) {

    const UserEntity = this.entities.utilisateur;
    const exists = await this.exists(userProps.email);
    console.log("exists ?", exists);

    if (!exists) {
      console.log("dans UserRepo create fctn", userProps);

  
      const user=  await UserEntity.create({
          data: {
            email: userProps.email,
            password: userProps.password,
            firstname: userProps.firstname,
            lastname: userProps.lastname,
          },
        })


      const expireIn="5min"
      const jwtToken = sign({ email: userProps.email}, REGISTER_TOKEN as string, {expiresIn:expireIn})
      console.log('REGITER TOKEN', jwtToken);

      const verificationLink = `http://localhost:${PORT}/${APP_BASE_URL}/users/verify/${user.id}/${jwtToken}`
      const emailToSend:string = "andria.capai@gmail.com" // userProps.email
      const subject:string = "Confirmez votre inscription à MyHappyWallet"
      const message:string =`Hi there
      <br/>
      Merci pour votre inscription à MyHappyWallet
      <br/><br/>
      Pour verifier votre compte veuillez cliquez sur le lien suivant: 
      <a href="${verificationLink}">${verificationLink}</a>
      <br/><br/>
      Je vous souhaite une bonne journée!` 

      const isEmailSent= await this.sendMail(emailToSend,subject,message)

      if (!isEmailSent){
        throw new ErrorException(ErrorCode.SendEmaillError)
      }
      return {success:true,message:`Email was sent to ${emailToSend}`}

    }
    throw new ErrorException(ErrorCode.SendEmaillError)
  }

  public async confirmRegistration(id:string, token:string) {
    const UserEntity = this.entities.utilisateur;
    // console.log(userProps.email)
    const user = await this.getUserById(parseInt(id));
    console.log("exists user?", user);

    if (!user) {
      throw new ErrorException(ErrorCode.SendEmaillError)
    }
    
    const token_check = await verify(token, REGISTER_TOKEN as string,function(err:any, _:any) {
      if (err) {
        console.log("WRONG REGISTER TOKEN")
        throw new ErrorException(ErrorCode.Unauthorized,"The register token is not valid.")
        // return refreshTokenAuth(req,res,next)
      } 
    })
    console.log("register_token_check",token_check)

    console.log(await UserEntity.update({
      where: {
          id: parseInt(id),
        },
      data: {
        verified:true,
      },
    }))

    return {success:true,message:`Registration User ${user.email} is successfull`}
  }
  public async exists(email: string): Promise<boolean> {
    const UserEntity = this.entities.utilisateur;

    // console.log('email dans findUnique', email)
    const result = await UserEntity.findUnique({ where: { email: email } });

    if (result === null) {
      this.emailExist = false;
    } else {
      this.emailExist = true;
    }
    return this.emailExist;
  }

  public async getUserByEmail(email: string) {
    const UserEntity = this.entities.utilisateur;

    const result = await UserEntity.findUnique({ where: { email: email } });

    return result;
  }
  public async getUserById(id: number) {
    const UserEntity = this.entities.utilisateur;

    const result = await UserEntity.findUnique({ where: { id: id } });

    return result;
  }
  public async sendMail(email:string,subject:string,text:string){
    console.log("await sending email confirmation");
    sgMail.setApiKey(SENDGRID_API_KEY as string);
    let trackingFalse:boolean = false
    if (NODE_ENV==="production"){
      trackingFalse=true
    }else{
      trackingFalse=false
    }
    const msg = {
      to: email, // Change to your recipient
      from: EMAIL_SENDER as string, // Change to your verified sender
      subject:subject,
      // text:text,
      html:text,
      trackingSettings: {
        clickTracking: {
          enable: trackingFalse,
          enableText: trackingFalse
        },
        openTracking: {
          enable: trackingFalse
        }
      }
    };

    const isEmailSent:Promise<boolean>=sgMail
      .send(msg)
      .then( async (response) => {
        console.log("RESPONSE MAIL",response[0].statusCode);
        console.log("RESPONSE HEADER",response[0].headers);
        if (response[0].statusCode == 202){
          return true

        } else{
          return false
        }
        
      } )
      .catch((error) => {
        console.log("ERROR EMAIL",error)
        throw new ErrorException(ErrorCode.SendEmaillError)
      });
      console.log("OUTSIDE THEN CATCH",isEmailSent)
      return isEmailSent
      
  }
}
