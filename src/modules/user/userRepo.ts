import { Result, ResultCode }  from './../../utils/results/';
import { ErrorException,ErrorCode }  from "./../../utils/errors/";
import {
  NODE_ENV,
  SENDGRID_API_KEY,
  // REGISTER_TOKEN,
  EMAIL_SENDER,
} from "./../../config/config";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service lié aux Users
import { createUserProps } from "../../utils/validators/register.validator";
import sgMail from "@sendgrid/mail";

export class UserRepo {
  private entities: any;
  private emailExist: boolean;
  private resetTokenExist: boolean;

  constructor(entities: any) {
    this.entities = entities;
  }

  public async create(userProps: createUserProps) {
    const UserEntity = this.entities.utilisateur;

    console.log("dans UserRepo create fctn", userProps);

    const user = await UserEntity.create({
      data: {
        email: userProps.email,
        password: userProps.password,
        firstname: userProps.firstname,
        lastname: userProps.lastname,
      },
    });

    return user
    // const expireIn = "5min";
    // const jwtToken = sign(
    //   { email: userProps.email },
    //   REGISTER_TOKEN as string,
    //   { expiresIn: expireIn }
    // );
    // console.log("REGITER TOKEN", jwtToken);

    // const verificationLink = `http://localhost:${PORT}/${APP_BASE_URL}/users/verify/${user.id}/${jwtToken}`;
    // const emailToSend: string = "andria.capai@gmail.com"; // userProps.email
    // const subject: string = "Confirmez votre inscription à MyHappyWallet";
    // const message: string = `Hi there
    //   <br/>
    //   Merci pour votre inscription à MyHappyWallet
    //   <br/><br/>
    //   Pour verifier votre compte veuillez cliquez sur le lien suivant: 
    //   <a href="${verificationLink}">${verificationLink}</a>
    //   <br/><br/>
    //   Je vous souhaite une bonne journée!`;

    // const isEmailSent = await this.sendMail(emailToSend, subject, message);

    // if (!isEmailSent) {
    //   throw new ErrorException(ErrorCode.SendEmaillError);
    // }
    // return await new Result(ResultCode.Created,`Email was sent to ${emailToSend}`).response_post()
    // return { success: true, message: `Email was sent to ${emailToSend}` };
  }

  public async resetPassword(email: string, resetToken:string, resetTokenExpiration:Date) {
    const UserEntity = this.entities.utilisateur;

      const user = await UserEntity.findUnique({
        where: { email: email },
      }).catch((err:any) => {console.log("Inside Prisma",err) ;throw new ErrorException(ErrorCode.PrismaError)});

      await UserEntity.update({
        where: {
          id: user.id,
        },
        data: {
          resetToken: resetToken,
          resetTokenExpiration:resetTokenExpiration ,
        },
      }).catch((err:any) => {console.log("Inside Prisma",err);throw new ErrorException(ErrorCode.PrismaError)});
      
      return await new Result(ResultCode.Created,`ResetToken successfully added`).response_post()
      // return {
      //   success: true,
      //   message: `ResetToken successfully added`,
      // };
  }

  public async newPassword(newpassword: string, resetToken: string) {
    const UserEntity = this.entities.utilisateur;
    // const result = await UserEntity.findMany({
    //   where: { resetToken: resetToken },
    //   select:{resetTokenExpiration:true}
    // });

    const result = await UserEntity.findMany({
      where: {
        resetToken: resetToken,
        resetTokenExpiration: {
          gte: new Date() /* Includes time offset for UTC */,
        },
      },
    })
    if (result===[] || result[0]==undefined ){
      throw new ErrorException(ErrorCode.Unauthorized)
    }

    const user = result[0]
    console.log("user found by resetToken", user);
    if (user.length > 1){
      throw new ErrorException(ErrorCode.Unauthorized,"Reset Token is expired")
    }

    // const today = new Date();
   
   
    // // const diffDate = datToCompare - resetTokenExpiratin// 36e5;
    // const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // console.log("timezone",timezone); // Asia/Karachi
    // console.log("date now", today)
    // console.log("date resetTokenExpiration", user.resetTokenExpiration)
    // console.log("date time zone diff",today.getTimezoneOffset() )
    // const Time = user.resetTokenExpiration.getTime()  - today.getTime(); 
    // const HoursDiff = Time / (1000 * 3600); //Diference in Days
    // console.log("diff date Hours",HoursDiff)
    // if (HoursDiff<0){
    //     throw new ErrorException(ErrorCode.Unauthorized)
    // }

    await UserEntity.updateMany({
      where: {
        id: user.id,
      },
      data: {
        password: newpassword,
        resetToken: null,
        resetTokenExpiration: null,
      },
    });

    return await new Result(ResultCode.Created,`New password created`).response_post()
    // return { success: true, message: `New password created` };
  }

  public async confirmRegistration(id: string) {
    const UserEntity = this.entities.utilisateur;
    // console.log(userProps.email)
    // const user = await this.getUserById(parseInt(id));
    // console.log("exists user?", user);

    // if (!user) {
    //   throw new ErrorException(ErrorCode.SendEmaillError);
    // }

    // const token_check = await verify(
    //   token,
    //   REGISTER_TOKEN as string,
    //   function (err: any, _: any) {
    //     if (err) {
    //       console.log("WRONG REGISTER TOKEN");
    //       throw new ErrorException(
    //         ErrorCode.Unauthorized,
    //         "The register token is not valid."
    //       );
    //       // return refreshTokenAuth(req,res,next)
    //     }
    //   }
    // );
    // console.log("register_token_check", token_check);

    console.log(
      await UserEntity.update({
        where: {
          id: parseInt(id),
        },
        data: {
          verified: true,
        },
      })
    );
    
    const result = await new Result(ResultCode.Created, `Registration User is successfull`).response_get()
    return result
    // return {
    //   success: true,
    //   message: `Registration User ${user.email} is successfull`,
    // };
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

  public async existUserResetToken(resetToken: string) {
    const UserEntity = this.entities.utilisateur;

    const result = await UserEntity.findMany({
      where: { resetToken: resetToken },
    });
    console.log("Check resetToken", result);
    if (result === null) {
      this.resetTokenExist = false;
    } else {
      this.resetTokenExist = true;
    }
    return this.resetTokenExist;
  }

  public async sendMail(email: string, subject: string, text: string) {
    console.log("await sending email confirmation");
    sgMail.setApiKey(SENDGRID_API_KEY as string);
    let trackingFalse: boolean = false;
    if (NODE_ENV === "production") {
      trackingFalse = true;
    } else {
      trackingFalse = false;
    }
    const msg = {
      to: email, // Change to your recipient
      from: EMAIL_SENDER as string, // Change to your verified sender
      subject: subject,
      // text:text,
      html: text,
      trackingSettings: {
        clickTracking: {
          enable: trackingFalse,
          enableText: trackingFalse,
        },
        openTracking: {
          enable: trackingFalse,
        },
      },
    };

    const isEmailSent: Promise<boolean> = sgMail
      .send(msg)
      .then(async (response) => {
        console.log("RESPONSE MAIL", response[0].statusCode);
        console.log("RESPONSE HEADER", response[0].headers);
        if (response[0].statusCode == 202) {
          return true;
        } else {
          return false;
        }
      })
      .catch((error) => {
        console.log("ERROR EMAIL", error);
        throw new ErrorException(ErrorCode.SendEmaillError);
      });
    console.log("OUTSIDE THEN CATCH", isEmailSent);
    return isEmailSent;
  }

}
