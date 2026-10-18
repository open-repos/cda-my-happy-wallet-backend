import { ErrorException,ErrorCode }  from "./../../utils/errors/";
import { toPrismaErrorException } from "../../utils/errors/prismaError.error";
// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service lié aux Users
import { createUserProps } from "../../utils/validators/register.validator";
import { IMailer } from "./mail/Mailer.interface";
import { createMailer } from "./mail/MailerFactory";
import { IUserRepository } from "./userRepository.interface";

export class UserRepo implements IUserRepository {
  private entities: any;
  private emailExist: boolean;
  private resetTokenExist: boolean;
  private isVerified:boolean;
  private mailer: IMailer;

  constructor(entities: any, mailer: IMailer = createMailer()) {
    this.entities = entities;
    this.mailer = mailer;
  }

  public async create(userProps: createUserProps) {
    return this.entities.$transaction(async (transaction: any) => {
      const templates = await transaction.operationCategoryTemplate.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });

      if (templates.length === 0) {
        throw new Error("Operation category templates are not initialized");
      }

      return transaction.utilisateur.create({
        data: {
          email: userProps.email,
          password: userProps.password,
          firstname: userProps.firstname,
          lastname: userProps.lastname,
          operationCategories: {
            create: templates.map(
              (template: {
                id: number;
                name: string;
                color: string | null;
              }) => ({
                name: template.name,
                color: template.color,
                template: { connect: { id: template.id } },
              })
            ),
          },
        },
      });
    });
  }

  public async delete(email: string,userId:number) {
    const UserEntity = this.entities.utilisateur;

    const result = await UserEntity.deleteMany({
      where: { email: email,id:userId }
    });

    return result
  }
  public async resetPassword(email: string, resetToken:string, resetTokenExpiration:Date) {
    const UserEntity = this.entities.utilisateur;

      const user = await UserEntity.findUnique({
        where: { email: email },
      }).catch((error:unknown) => {throw toPrismaErrorException(error,"Account email not found , you can register")});

      const result = await UserEntity.update({
        where: {
          id: user.id,
        },
        data: {
          resetToken: resetToken,
          resetTokenExpiration:resetTokenExpiration ,
        },
      }).catch((error:unknown) => {throw toPrismaErrorException(error)});
      
      return result
      // return {
      //   success: true,
      //   message: `ResetToken successfully added`,
      // };
  }

  public async newPassword(newpassword: string, resetToken: string) {
    const UserEntity = this.entities.utilisateur;
    const users = await UserEntity.findMany({
      where: {
        resetToken: resetToken,
        resetTokenExpiration: {
          gte: new Date() /* Includes time offset for UTC */,
        },
      },
      select: { id: true },
      take: 2,
    })

    if (users.length !== 1) {
      throw new ErrorException(ErrorCode.Unauthorized)
    }

    const resultUpdate = await UserEntity.updateMany({
      where: {
        id: users[0].id,
        resetToken: resetToken,
        resetTokenExpiration: {
          gte: new Date(),
        },
      },
      data: {
        password: newpassword,
        resetToken: null,
        resetTokenExpiration: null,
      },
    });

    if (resultUpdate.count !== 1) {
      throw new ErrorException(ErrorCode.Unauthorized)
    }

    return resultUpdate
    // return { success: true, message: `New password created` };
  }

  public async confirmRegistration(id: string, email: string): Promise<boolean> {
    const UserEntity = this.entities.utilisateur;
    const result = await UserEntity.updateMany({
        where: {
          id: parseInt(id),
          email,
          verified: false,
        },
        data: {
          verified: true,
        },
      });
    return result.count === 1
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

  public async hasValidResetToken(resetToken: string) {
    const UserEntity = this.entities.utilisateur;

    const count = await UserEntity.count({
      where: {
        resetToken: resetToken,
        resetTokenExpiration: {
          gte: new Date(),
        },
      },
    });
    this.resetTokenExist = count === 1;
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
