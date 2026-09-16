import { createUserProps } from "../../utils/validators/register.validator";

export interface IUserRepository {
  create(userProps: createUserProps): Promise<any>;
  delete(email: string, userId: number): Promise<any>;
  resetPassword(
    email: string,
    resetToken: string,
    resetTokenExpiration: Date
  ): Promise<any>;
  newPassword(newpassword: string, resetToken: string): Promise<any>;
  confirmRegistration(id: string, email: string): Promise<boolean>;
  exists(email: string): Promise<boolean>;
  getUserByEmail(email: string): Promise<any>;
  getUserById(id: number): Promise<any>;
  hasValidResetToken(resetToken: string): Promise<boolean>;
  isUserAccountVerified(email: string): Promise<boolean>;
  sendMail(email: string, subject: string, text: string): Promise<boolean>;
}
