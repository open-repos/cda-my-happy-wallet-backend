import assert from "assert";
import { CreateUser } from "../../../src/modules/user/useCases/createUser/createUser";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { createUserProps } from "../../../src/utils/validators/register.validator";
import { FakeTokenService } from "../../fakes/FakeTokenService";

class RegistrationRepository implements IUserRepository {
  public sentMail: { email: string; subject: string; text: string } | null = null;
  public userExists = false;
  public accountVerified = false;
  public createCalls = 0;

  public async create(_props: createUserProps): Promise<any> {
    this.createCalls += 1;
    return { id: 42 };
  }
  public async delete(): Promise<any> { throw new Error("Not used"); }
  public async resetPassword(): Promise<any> { throw new Error("Not used"); }
  public async newPassword(): Promise<any> { throw new Error("Not used"); }
  public async confirmRegistration(): Promise<any> { throw new Error("Not used"); }
  public async exists(): Promise<boolean> { return this.userExists; }
  public async getUserByEmail(): Promise<any> { throw new Error("Not used"); }
  public async getUserById(): Promise<any> { throw new Error("Not used"); }
  public async hasValidResetToken(): Promise<boolean> { return false; }
  public async isUserAccountVerified(): Promise<boolean> { return this.accountVerified; }

  public async sendMail(email: string, subject: string, text: string): Promise<boolean> {
    this.sentMail = { email, subject, text };
    return true;
  }
}

async function run() {
  const repository = new RegistrationRepository();
  const createUser = new CreateUser(repository, new FakeTokenService());
  const email = "new-user@example.com";

  const result = await createUser.execute({
    email,
    password: "LocalPass!1",
    confirmpassword: "LocalPass!1",
    firstname: "Local",
    lastname: "Tester",
  });

  assert.ok(repository.sentMail);
  assert.strictEqual(repository.sentMail.email, email);
  assert.match(repository.sentMail.text, /http:\/\/localhost:4200\/v1\/users\/verify\/42\/fake\.jwt\.token/);
  assert.strictEqual(result.success, true);
  assert.strictEqual(
    result.message,
    "If registration is available, a confirmation email will be sent."
  );

  const existingRepository = new RegistrationRepository();
  existingRepository.userExists = true;
  existingRepository.accountVerified = true;
  const existingResult = await new CreateUser(
    existingRepository,
    new FakeTokenService()
  ).execute({
    email,
    password: "LocalPass!1",
    confirmpassword: "LocalPass!1",
    firstname: "Local",
    lastname: "Tester",
  });

  assert.strictEqual(existingResult.message, result.message);
  assert.strictEqual(existingRepository.createCalls, 0);
  assert.strictEqual(existingRepository.sentMail, null);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
