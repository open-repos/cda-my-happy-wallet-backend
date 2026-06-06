import { ErrorException,ErrorCode }  from "./../../utils/errors/";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service lié aux Users
import { createUserProps } from "../../utils/validators/register.validator";
import { IMailer } from "./mail/Mailer.interface";
import { SendGridMailer } from "./mail/SendGridMailer";
import { IUserRepository } from "./userRepository.interface";

export class UserRepo implements IUserRepository {
  private entities: any;
  private emailExist: boolean;
  private resetTokenExist: boolean;
  private isVerified:boolean;
  private mailer: IMailer;

  constructor(entities: any, mailer: IMailer = new SendGridMailer()) {
    this.entities = entities;
    this.mailer = mailer;
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
  }

  public async delete(email: string,userId:number) {
    const UserEntity = this.entities.utilisateur;

    console.log("dans UserRepo delete fctn");

    const result = await UserEntity.deleteMany({
      where: { email: email,id:userId }
    });

    return result
  }
  public async resetPassword(email: string, resetToken:string, resetTokenExpiration:Date) {
    const UserEntity = this.entities.utilisateur;

      const user = await UserEntity.findUnique({
        where: { email: email },
      }).catch((err:any) => {console.log("Inside Prisma",err) ;throw new ErrorException(ErrorCode.PrismaError,"Account email not found , you can register")});

      const result = await UserEntity.update({
        where: {
          id: user.id,
        },
        data: {
          resetToken: resetToken,
          resetTokenExpiration:resetTokenExpiration ,
        },
      }).catch((err:any) => {console.log("Inside Prisma",err);throw new ErrorException(ErrorCode.PrismaError)});
      
      return result
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
    if (result.length === 0 || result[0]==undefined ){
      throw new ErrorException(ErrorCode.Unauthorized)
    }

    const user = result[0]
    console.log("user found by resetToken", user);
    if (user.length > 1){
      throw new ErrorException(ErrorCode.Unauthorized,"Reset Token is expired")
    }

    const resultUpdate = await UserEntity.updateMany({
      where: {
        id: user.id,
      },
      data: {
        password: newpassword,
        resetToken: null,
        resetTokenExpiration: null,
      },
    });

    return resultUpdate
    // return { success: true, message: `New password created` };
  }

  public async confirmRegistration(id: string) {
    const UserEntity = this.entities.utilisateur;
    const result = await UserEntity.update({
        where: {
          id: parseInt(id),
        },
        data: {
          verified: true,
        },
      });
    console.log(result);
    
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
    console.log(result === null || result == []);
    if (result === null || result.length === 0 ) {
      this.resetTokenExist = false;
    } else {
      this.resetTokenExist = true;
    }
    return this.resetTokenExist;
  }


  public async isUserAccountVerified(email: string) {
    const UserEntity = this.entities.utilisateur;

    const result = await UserEntity.findUnique({ where: { email: email } });
    if (result === null) {
      this.isVerified = false;
    } else {
      this.isVerified = result.verified;
    }
    return this.isVerified;
  }

  public async sendMail(email: string, subject: string, text: string) {
    return this.mailer.sendMail(email, subject, text);
  }

}
